'use server';

import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongoose';
import Inward from '@/lib/models/Inward';
import Outward from '@/lib/models/Outward';
import Warehouse from '@/lib/models/Warehouse';
import Commodity from '@/lib/models/Commodity';
import Client from '@/lib/models/Client';
import RevenueDistribution from '@/lib/models/RevenueDistribution';
import { revalidatePath } from 'next/cache';
import { calculateRent } from '@/lib/pricing-engine';

async function createTransactionSession() {
  await connectToDatabase();
  if (!mongoose.connection.db) {
    throw new Error('Database connection not established');
  }
  
  const admin = mongoose.connection.db.admin();
  const serverInfo = await admin.command({ hello: 1 }).catch(() => admin.command({ isMaster: 1 }));
  const supportsTransactions = Boolean(serverInfo.setName || serverInfo.msg === 'isdbgrid');

  if (!supportsTransactions) {
    return null;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  return session;
}

function parseIsoDate(value: any): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculates current stock balance for Client + Commodity + Warehouse
 */
export async function getStockBalance(clientId: string, commodityId: string, warehouseId: string) {
  await connectToDatabase();

  const inwardResult = await Inward.aggregate([
    {
      $match: {
        clientId: new mongoose.Types.ObjectId(clientId),
        commodityId: new mongoose.Types.ObjectId(commodityId),
        warehouseId: new mongoose.Types.ObjectId(warehouseId),
      },
    },
    { $group: { _id: null, total: { $sum: '$quantityMT' } } },
  ]);

  const outwardResult = await Outward.aggregate([
    {
      $match: {
        clientId: new mongoose.Types.ObjectId(clientId),
        commodityId: new mongoose.Types.ObjectId(commodityId),
        warehouseId: new mongoose.Types.ObjectId(warehouseId),
      },
    },
    { $group: { _id: null, total: { $sum: '$quantityMT' } } },
  ]);

  const totalInwardValue = inwardResult[0]?.total || 0;
  const totalOutwardValue = outwardResult[0]?.total || 0;

  return totalInwardValue - totalOutwardValue;
}

/**
 * Processes Inward entry with Grouped Invoicing and Revenue Distribution
 */
export async function processInward(data: {
  clientId: string;
  commodityId: string;
  warehouseId: string;
  quantityMT: number;
  bagsCount: number;
  stackNo?: string;
  lotNo?: string;
  gatePass?: string;
  date?: string | Date;
  outwardDate: string | Date;
}) {
  const session = await createTransactionSession();
  const createOptions: { session: mongoose.ClientSession } | undefined = session ? { session } : undefined;

  try {
    const inwardDate = data.date ? new Date(data.date) : new Date();
    const outwardDate = new Date(data.outwardDate);

    // 0. Fetch Commodity for Rate
    const commodityQuery = Commodity.findById(data.commodityId);
    const commodity = session ? await commodityQuery.session(session) : await commodityQuery;
    if (!commodity) throw new Error('Commodity not found');

    // 1. Resolve client, commodity, and warehouse names for transaction linkage
    const clientQuery = Client.findById(data.clientId);
    const warehouseQuery = Warehouse.findById(data.warehouseId);
    const [client, warehouse] = session
      ? await Promise.all([clientQuery.session(session), warehouseQuery.session(session)])
      : await Promise.all([clientQuery, warehouseQuery]);

    if (!client) throw new Error('Client not found');
    if (!warehouse) throw new Error('Warehouse not found');

    // 2. Create Inward Record
    const [newInward] = session
      ? await Inward.create([{
          ...data,
          date: inwardDate,
          outwardDate: outwardDate
        }], createOptions)
      : await Inward.create([{
          ...data,
          date: inwardDate,
          outwardDate: outwardDate
        }]);

    // 3. Update Warehouse Capacity
    if (warehouse.occupiedCapacity + data.quantityMT > warehouse.totalCapacity) {
      throw new Error('Transaction exceeds warehouse total capacity');
    }
    warehouse.occupiedCapacity += data.quantityMT;
    if (warehouse.occupiedCapacity >= warehouse.totalCapacity) warehouse.status = 'FULL';
    if (session) {
      await warehouse.save({ session });
    } else {
      await warehouse.save();
    }

    // 4. Link into shared transaction history
    const inwardTransaction = {
      accountId: data.clientId,
      clientId: data.clientId,
      commodityId: data.commodityId,
      warehouseId: data.warehouseId,
      clientName: client.name,
      commodityName: commodity.name,
      warehouseName: warehouse.name,
      direction: 'INWARD',
      type: 'INWARD',
      date: inwardDate,
      quantityMT: data.quantityMT,
      bagsCount: data.bagsCount,
      stackNo: data.stackNo,
      lotNo: data.lotNo,
      gatePass: data.gatePass || `GP-${Date.now()}`,
      status: 'COMPLETED',
      sourceType: 'inward',
      sourceId: newInward._id?.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not established');

    await db.collection('transactions').insertOne(
      inwardTransaction,
      session ? { session } : undefined
    );

    // 5. Create Ledger Entry for Invoice Generation
    const ratePerMTPerDay = commodity.ratePerMtPerDay || 10;
    const ledgerEntry = {
      clientId: new mongoose.Types.ObjectId(data.clientId),
      warehouseId: new mongoose.Types.ObjectId(data.warehouseId),
      commodityId: new mongoose.Types.ObjectId(data.commodityId),
      periodStartDate: inwardDate.toISOString().split('T')[0],
      periodEndDate: outwardDate.toISOString().split('T')[0],
      quantityMT: data.quantityMT,
      status: 'ACTIVE',
      ratePerMTPerDay: ratePerMTPerDay,
      version: 1,
      createdAt: new Date(),
    };

    await db.collection('ledger_entries').insertOne(
      ledgerEntry,
      session ? { session } : undefined
    );

    // 3. Financial Calculations
    const monthlyRate = commodity.ratePerMtPerDay * 30; // Convert daily rate to monthly
    const rent = calculateRent(data.quantityMT, monthlyRate, inwardDate, outwardDate);
    
    // Revenue Split (60/40)
    const totalAmount = rent.totalAmount;
    const ownerShare = Math.round(totalAmount * 0.6 * 100) / 100;
    const platformShare = Math.round((totalAmount - ownerShare) * 100) / 100;

    if (session) {
      await RevenueDistribution.create([{
        inwardId: newInward._id,
        clientId: data.clientId,
        warehouseId: data.warehouseId,
        totalAmount,
        ownerShare,
        platformShare,
      }], { session });
    } else {
      await RevenueDistribution.create([{
        inwardId: newInward._id,
        clientId: data.clientId,
        warehouseId: data.warehouseId,
        totalAmount,
        ownerShare,
        platformShare,
      }]);
    }

    if (session) {
      await session.commitTransaction();
    }

    // Revalidation
    revalidatePath('/dashboard/inward');
    revalidatePath('/dashboard/warehouses');
    revalidatePath('/dashboard/ledger');
    revalidatePath('/dashboard/reports');
    revalidatePath('/dashboard/revenue');

    return {
      success: true,
      data: JSON.parse(JSON.stringify(newInward))
    };
  } catch (error: unknown) {
    if (session) {
      await session.abortTransaction();
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

/**
 * Processes Outward withdrawal
 */
export async function processOutward(data: {
  clientId: string;
  commodityId: string;
  warehouseId: string;
  quantityMT: number;
  stackNo?: string;
  lotNo?: string;
  gatePass?: string;
  date?: string | Date;
}) {
  const session = await createTransactionSession();

  try {
    const outwardDate = data.date ? new Date(data.date) : new Date();

    const currentBalance = await getStockBalance(data.clientId, data.commodityId, data.warehouseId);
    if (data.quantityMT > currentBalance) {
      throw new Error(`Insufficient stock. Available: ${currentBalance} MT`);
    }

    const clientQuery = Client.findById(data.clientId);
    const commodityQuery = Commodity.findById(data.commodityId);
    const warehouseQuery = Warehouse.findById(data.warehouseId);
    const [client, commodity, warehouse] = session
      ? await Promise.all([clientQuery.session(session), commodityQuery.session(session), warehouseQuery.session(session)])
      : await Promise.all([clientQuery, commodityQuery, warehouseQuery]);

    if (!client) throw new Error('Client not found');
    if (!commodity) throw new Error('Commodity not found');
    if (!warehouse) throw new Error('Warehouse not found');

    const [newOutward] = session
      ? await Outward.create([{
          ...data,
          date: outwardDate
        }], { session })
      : await Outward.create([{
          ...data,
          date: outwardDate
        }]);

    const outwardTransaction = {
      accountId: data.clientId,
      clientId: data.clientId,
      commodityId: data.commodityId,
      warehouseId: data.warehouseId,
      clientName: client.name,
      commodityName: commodity.name,
      warehouseName: warehouse.name,
      direction: 'OUTWARD',
      type: 'OUTWARD',
      date: outwardDate,
      quantityMT: data.quantityMT,
      stackNo: data.stackNo,
      lotNo: data.lotNo,
      gatePass: data.gatePass || `GP-${Date.now()}`,
      status: 'COMPLETED',
      sourceType: 'outward',
      sourceId: newOutward._id?.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (warehouse.occupiedCapacity - data.quantityMT < 0) {
      throw new Error('Warehouse stock cannot become negative');
    }
    warehouse.occupiedCapacity -= data.quantityMT;
    if (warehouse.occupiedCapacity < warehouse.totalCapacity && warehouse.status === 'FULL') {
      warehouse.status = 'ACTIVE';
    }
    if (session) {
      await warehouse.save({ session });
    } else {
      await warehouse.save();
    }

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not established');

    await db.collection('transactions').insertOne(
      outwardTransaction,
      session ? { session } : undefined
    );

    // Update ledger entries for this client/commodity/warehouse combination
    // Find active ledger entries and update their end date to reflect actual stock withdrawal
    await db.collection('ledger_entries').updateMany(
      {
        clientId: new mongoose.Types.ObjectId(data.clientId),
        commodityId: new mongoose.Types.ObjectId(data.commodityId),
        warehouseId: new mongoose.Types.ObjectId(data.warehouseId),
        status: 'ACTIVE'
      },
      {
        $set: {
          periodEndDate: outwardDate.toISOString().split('T')[0],
          updatedAt: new Date()
        }
      },
      session ? { session } : undefined
    );

    if (session) {
      await session.commitTransaction();
    }
    revalidatePath('/dashboard/outward');
    revalidatePath('/dashboard/warehouses');
    revalidatePath('/dashboard/ledger');
    revalidatePath('/dashboard/reports');

    return { success: true, data: JSON.parse(JSON.stringify(newOutward)) };
  } catch (error: unknown) {
    if (session) {
      await session.abortTransaction();
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

export async function getRevenueAnalyticsFromInvoices(warehouseId?: string) {
  await connectToDatabase();

  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not established');

  // Get inward transactions with populated data
  const inwards = await db.collection('inwards').aggregate([
    { $match: { clientId: new mongoose.Types.ObjectId(clientId) } },
    {
      $lookup: {
        from: 'clients',
        localField: 'clientId',
        foreignField: '_id',
        as: 'client'
      }
    },
    {
      $lookup: {
        from: 'commodities',
        localField: 'commodityId',
        foreignField: '_id',
        as: 'commodity'
      }
    },
    {
      $lookup: {
        from: 'warehouses',
        localField: 'warehouseId',
        foreignField: '_id',
        as: 'warehouse'
      }
    },
    {
      $addFields: {
        client: { $arrayElemAt: ['$client', 0] },
        commodityObj: { $arrayElemAt: ['$commodity', 0] },
        warehouse: { $arrayElemAt: ['$warehouse', 0] },
        type: 'INWARD',
        transactionType: 'Stock Inward',
        amount: 0,
        description: {
          $concat: [
            "Stock Inward - ",
            { $toString: "$quantityMT" },
            " MT"
          ]
        }
      }
    }
  ]).toArray();

  // Get outward transactions with populated data
  const outwards = await db.collection('outwards').aggregate([
    { $match: { clientId: new mongoose.Types.ObjectId(clientId) } },
    {
      $lookup: {
        from: 'clients',
        localField: 'clientId',
        foreignField: '_id',
        as: 'client'
      }
    },
    {
      $lookup: {
        from: 'commodities',
        localField: 'commodityId',
        foreignField: '_id',
        as: 'commodity'
      }
    },
    {
      $lookup: {
        from: 'warehouses',
        localField: 'warehouseId',
        foreignField: '_id',
        as: 'warehouse'
      }
    },
    {
      $addFields: {
        client: { $arrayElemAt: ['$client', 0] },
        commodityObj: { $arrayElemAt: ['$commodity', 0] },
        warehouse: { $arrayElemAt: ['$warehouse', 0] },
        type: 'OUTWARD',
        transactionType: 'Stock Outward',
        amount: 0,
        description: {
          $concat: [
            "Stock Outward - ",
            { $toString: "$quantityMT" },
            " MT"
          ]
        }
      }
    }
  ]).toArray();

  // Get ledger entries (billing periods)
  const ledgerEntries = await db.collection('ledger_entries').aggregate([
    { $match: { clientId: new mongoose.Types.ObjectId(clientId) } },
    {
      $lookup: {
        from: 'clients',
        localField: 'clientId',
        foreignField: '_id',
        as: 'client'
      }
    },
    {
      $lookup: {
        from: 'commodities',
        localField: 'commodityId',
        foreignField: '_id',
        as: 'commodity'
      }
    },
    {
      $lookup: {
        from: 'warehouses',
        localField: 'warehouseId',
        foreignField: '_id',
        as: 'warehouse'
      }
    },
    {
      $addFields: {
        client: { $arrayElemAt: ['$client', 0] },
        commodity: { $arrayElemAt: ['$commodity', 0] },
        warehouse: { $arrayElemAt: ['$warehouse', 0] },
        type: 'LEDGER',
        transactionType: 'Billing Period',
        amount: {
          $multiply: [
            '$quantityMT',
            '$ratePerMTPerDay',
            { $divide: [{ $subtract: [new Date('$periodEndDate'), new Date('$periodStartDate')] }, 1000 * 60 * 60 * 24] }
          ]
        },
        description: `Billing: ${'$commodity.name'} - ${'$quantityMT'} MT @ ₹${'$ratePerMTPerDay'}/MT/day`
      }
    }
  ]).toArray();

  // Get invoice data
  const invoices = await Invoice.find({ clientId })
    .populate('warehouseId')
    .sort({ createdAt: -1 })
    .lean();

  // Combine all transactions and sort by date
  const allTransactions = [
    ...inwards.map(inward => ({
      ...inward,
      _id: inward._id.toString(),
      date: inward.createdAt || inward.date,
      ledgerType: 'transaction'
    })),
    ...outwards.map(outward => ({
      ...outward,
      _id: outward._id.toString(),
      date: outward.createdAt || outward.date,
      ledgerType: 'transaction'
    })),
    ...ledgerEntries.map(entry => ({
      ...entry,
      _id: entry._id.toString(),
      date: entry.createdAt,
      ledgerType: 'billing'
    })),
    ...invoices.map(invoice => ({
      ...invoice,
      _id: invoice._id.toString(),
      date: invoice.generatedAt || invoice.createdAt,
      type: 'INVOICE',
      transactionType: 'Invoice Generated',
      amount: invoice.totalAmount,
      description: `Invoice ${invoice.invoiceId} - ₹${invoice.totalAmount.toLocaleString()}`,
      ledgerType: 'invoice'
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return JSON.parse(JSON.stringify(allTransactions));
}

export async function getRevenueAnalyticsFromInvoices(warehouseId?: string) {
  await connectToDatabase();

  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not established');

  // Get all inward/outward transactions for inventory-based revenue calculation
  const inwardMatch: any = {};
  const outwardMatch: any = {};

  if (warehouseId && warehouseId !== 'ALL') {
    inwardMatch.warehouseId = new mongoose.Types.ObjectId(warehouseId);
    outwardMatch.warehouseId = new mongoose.Types.ObjectId(warehouseId);
  }

  // Get all inward transactions
  const inwards = await db.collection('inwards').aggregate([
    { $match: inwardMatch },
    {
      $lookup: {
        from: 'warehouses',
        localField: 'warehouseId',
        foreignField: '_id',
        as: 'warehouse'
      }
    },
    {
      $lookup: {
        from: 'clients',
        localField: 'clientId',
        foreignField: '_id',
        as: 'client'
      }
    },
    {
      $lookup: {
        from: 'commodities',
        localField: 'commodityId',
        foreignField: '_id',
        as: 'commodity'
      }
    },
    {
      $addFields: {
        warehouseName: { $arrayElemAt: ['$warehouse.name', 0] },
        clientName: { $arrayElemAt: ['$client.name', 0] },
        commodityName: { $arrayElemAt: ['$commodity.name', 0] },
        ratePerMTPerDay: { $arrayElemAt: ['$commodity.ratePerMtPerDay', 0] }
      }
    }
  ]).toArray();

  // Get all outward transactions
  const outwards = await db.collection('outwards').aggregate([
    { $match: outwardMatch },
    {
      $lookup: {
        from: 'warehouses',
        localField: 'warehouseId',
        foreignField: '_id',
        as: 'warehouse'
      }
    },
    {
      $lookup: {
        from: 'clients',
        localField: 'clientId',
        foreignField: '_id',
        as: 'client'
      }
    },
    {
      $lookup: {
        from: 'commodities',
        localField: 'commodityId',
        foreignField: '_id',
        as: 'commodity'
      }
    },
    {
      $addFields: {
        warehouseName: { $arrayElemAt: ['$warehouse.name', 0] },
        clientName: { $arrayElemAt: ['$client.name', 0] },
        commodityName: { $arrayElemAt: ['$commodity.name', 0] },
        ratePerMTPerDay: { $arrayElemAt: ['$commodity.ratePerMtPerDay', 0] }
      }
    }
  ]).toArray();

  // Group by warehouse and month for inventory-based calculation
  const warehouseMonthlyData = new Map<string, {
    warehouseId: string;
    warehouseName: string;
    month: string;
    year: number;
    inventoryChanges: Array<{
      date: string;
      quantityMT: number;
      type: 'INWARD' | 'OUTWARD';
    }>;
    commodityRates: Map<string, number>;
  }>();

  // Process inward transactions
  for (const inward of inwards) {
    const warehouseId = String(inward.warehouseId);
    const warehouseName = inward.warehouseName || 'Unknown Warehouse';
    const date = inward.date;
    const monthKey = `${warehouseId}_${date.toISOString().slice(0, 7)}`; // YYYY-MM

    const bucket = warehouseMonthlyData.get(monthKey) ?? {
      warehouseId,
      warehouseName,
      month: date.toISOString().slice(0, 7),
      year: date.getFullYear(),
      inventoryChanges: [],
      commodityRates: new Map()
    };

    // Add inward change
    bucket.inventoryChanges.push({
      date: date.toISOString().split('T')[0],
      quantityMT: inward.quantityMT,
      type: 'INWARD'
    });

    // Store commodity rate
    const commodityId = String(inward.commodityId);
    const rate = Number(inward.ratePerMTPerDay) || 10;
    bucket.commodityRates.set(commodityId, rate);

    warehouseMonthlyData.set(monthKey, bucket);
  }

  // Process outward transactions
  for (const outward of outwards) {
    const warehouseId = String(outward.warehouseId);
    const warehouseName = outward.warehouseName || 'Unknown Warehouse';
    const date = outward.date;
    const monthKey = `${warehouseId}_${date.toISOString().slice(0, 7)}`; // YYYY-MM

    const bucket = warehouseMonthlyData.get(monthKey) ?? {
      warehouseId,
      warehouseName,
      month: date.toISOString().slice(0, 7),
      year: date.getFullYear(),
      inventoryChanges: [],
      commodityRates: new Map()
    };

    // Add outward change (negative quantity)
    bucket.inventoryChanges.push({
      date: date.toISOString().split('T')[0],
      quantityMT: -outward.quantityMT,
      type: 'OUTWARD'
    });

    // Store commodity rate
    const commodityId = String(outward.commodityId);
    const rate = Number(outward.ratePerMTPerDay) || 10;
    bucket.commodityRates.set(commodityId, rate);

    warehouseMonthlyData.set(monthKey, bucket);
  }

  // Calculate inventory-based revenue for each warehouse-month
  const monthlyRevenueByWarehouse = [];
  for (const [, bucket] of warehouseMonthlyData) {
    // Use the first commodity rate found (assuming single commodity per warehouse-month for simplicity)
    const ratePerDay = Array.from(bucket.commodityRates.values())[0] || 10;

    const monthStart = new Date(`${bucket.month}-01T00:00:00.000Z`);
    const openingInventory = Math.max(
      0,
      inwards.reduce((sum, inward) => {
        if (String(inward.warehouseId) === bucket.warehouseId && inward.date < monthStart) {
          return sum + inward.quantityMT;
        }
        return sum;
      }, 0) -
      outwards.reduce((sum, outward) => {
        if (String(outward.warehouseId) === bucket.warehouseId && outward.date < monthStart) {
          return sum + outward.quantityMT;
        }
        return sum;
      }, 0)
    );

    if (openingInventory > 0) {
      bucket.inventoryChanges.unshift({
        date: monthStart.toISOString().split('T')[0],
        quantityMT: openingInventory,
        type: 'INWARD'
      });
    }

    // Calculate simple revenue based on transactions (simplified since inventory-based billing was removed)
    const totalRevenue = bucket.inventoryChanges.reduce((sum, change) => {
      // Simple calculation: assume average rate for the month
      return sum + (change.quantityMT * ratePerDay * 30);
    }, 0);

    monthlyRevenueByWarehouse.push({
      warehouseId: bucket.warehouseId,
      warehouseName: bucket.warehouseName,
      month: bucket.month,
      year: bucket.year,
      totalDays: 30, // Assume full month
      totalQuantityDays: bucket.inventoryChanges.reduce((sum, change) => sum + change.quantityMT, 0),
      avgQuantityMT: bucket.inventoryChanges.length > 0 ? bucket.inventoryChanges.reduce((sum, change) => sum + change.quantityMT, 0) / bucket.inventoryChanges.length : 0,
      totalRevenue: Math.round(totalRevenue),
      ownerShare: Math.round(totalRevenue * 0.6),
      platformShare: Math.round(totalRevenue * 0.4),
      endingInventory: bucket.inventoryChanges.length > 0 ? bucket.inventoryChanges[bucket.inventoryChanges.length - 1].quantityMT : 0,
      ledgerCount: bucket.inventoryChanges.length
    });
  }

  // Sort by year/month descending
  monthlyRevenueByWarehouse.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    if (a.month !== b.month) return b.month < a.month ? 1 : -1;
    return b.totalRevenue - a.totalRevenue;
  });

  const totalRevenue = monthlyRevenueByWarehouse.reduce((sum, item) => sum + item.totalRevenue, 0);
  const ownerEarnings = Math.round(totalRevenue * 0.6);
  const platformCommissions = Math.round(totalRevenue * 0.4);

  // Get recent ledger entries for the logs (keeping for compatibility)
  const recentLedgerEntries = await db.collection('ledger_entries')
    .aggregate([
      {
        $match: {
          quantityMT: { $exists: true, $ne: null },
          ratePerMTPerDay: { $exists: true, $ne: null }
        }
      },
      {
        $lookup: {
          from: 'warehouses',
          localField: 'warehouseId',
          foreignField: '_id',
          as: 'warehouse'
        }
      },
      {
        $lookup: {
          from: 'clients',
          localField: 'clientId',
          foreignField: '_id',
          as: 'client'
        }
      },
      {
        $addFields: {
          warehouseName: { $arrayElemAt: ['$warehouse.name', 0] },
          clientName: { $arrayElemAt: ['$client.name', 0] }
        }
      },
      { $sort: { createdAt: -1 } },
      { $limit: 10 }
    ]).toArray();

  return {
    summary: {
      totalRevenue,
      ownerEarnings,
      platformCommissions,
    },
    monthlyWarehouseRevenue: monthlyRevenueByWarehouse,
    recentLogs: recentLedgerEntries.map((entry: any) => {
      // Calculate revenue for this ledger entry
      const days = entry.periodEndDate && entry.periodStartDate
        ? Math.max(1, Math.ceil((new Date(entry.periodEndDate).getTime() - new Date(entry.periodStartDate).getTime()) / (1000 * 60 * 60 * 24)))
        : 30;
      const totalAmount = Math.round((entry.quantityMT || 0) * (entry.ratePerMTPerDay || 10) * days);
      const ownerShare = Math.round(totalAmount * 0.6);
      const platformShare = Math.round(totalAmount * 0.4);

      return {
        _id: entry._id.toString(),
        createdAt: entry.createdAt,
        totalAmount: totalAmount || 0,
        ownerShare: ownerShare || 0,
        platformShare: platformShare || 0,
        clientId: { name: entry.clientName || 'Unknown Client' },
        warehouseId: { name: entry.warehouseName || 'Unknown Warehouse' }
      };
    }),
  };

}
