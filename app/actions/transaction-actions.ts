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
  bagsCount?: number;
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

/**
 * Get revenue analytics from invoices and payments with old logic
 * Calculates revenue splits by warehouse and month, considering outward entries
 */
export async function getRevenueAnalyticsFromInvoices(warehouseId?: string) {
  await connectToDatabase();

  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not established');

  try {
    // Get all ledger entries
    const allLedgerEntries = await db.collection('ledger_entries').find({}).toArray();

    console.log('[getRevenueAnalyticsFromInvoices] Total ledger entries:', allLedgerEntries.length);

    // Get outward entries to determine actual end dates
    const outwards = await db.collection('outwards').find({}).toArray();
    console.log('[getRevenueAnalyticsFromInvoices] Total outward entries:', outwards.length);

    // Create map of earliest outward dates by client/warehouse/commodity
    const outwardDates = new Map<string, Date>();
    outwards.forEach(outward => {
      const key = `${outward.clientId}-${outward.warehouseId}-${outward.commodityId}`;
      const outwardDate = new Date(outward.date);
      outwardDate.setHours(23, 59, 59, 999); // End of day

      if (!outwardDates.has(key) || outwardDate < outwardDates.get(key)!) {
        outwardDates.set(key, outwardDate);
      }
    });

    // Filter by warehouse if provided
    let filteredEntries = allLedgerEntries;
    if (warehouseId && warehouseId !== 'ALL') {
      const warehouseObjectId = new mongoose.Types.ObjectId(warehouseId);
      filteredEntries = allLedgerEntries.filter(entry =>
        entry.warehouseId.toString() === warehouseObjectId.toString()
      );
    }

    // Get warehouse names
    const warehouseIds = [...new Set(filteredEntries.map((entry: any) => entry.warehouseId.toString()))];
    const warehouses = await db.collection('warehouses').find({
      _id: { $in: warehouseIds.map(id => new mongoose.Types.ObjectId(id)) }
    }).toArray();
    const warehouseMap = new Map(warehouses.map(w => [w._id.toString(), w.name]));

    // Process entries and group by warehouse and month
    const monthlyData = new Map<string, any>();
    // Use as-of date as yesterday (2026-04-19) to match ledger logic
    const currentDate = new Date('2026-04-19T00:00:00.000Z');
    let totalRevenue = 0;

    filteredEntries.forEach((entry: any) => {
      const startDate = new Date(entry.periodStartDate);

      let endDate = entry.periodEndDate ? new Date(entry.periodEndDate) : new Date(currentDate);
      // Cap end date at as-of date (yesterday)
      if (endDate > currentDate) {
        endDate = new Date(currentDate);
      }

      // Adjust end date based on outward entries
      const key = `${entry.clientId}-${entry.warehouseId}-${entry.commodityId}`;
      if (outwardDates.has(key)) {
        const outwardDate = outwardDates.get(key)!;
        if (outwardDate > startDate && outwardDate < endDate) {
          endDate = outwardDate;
        }
      }


      // Skip entries that end before they start or have no valid period
      if (endDate < startDate) {
        return;
      }

      const quantity = entry.quantityMT || 0;
      const rate = entry.ratePerMTPerDay || 0;
      const warehouseIdStr = entry.warehouseId.toString();

      // Calculate full rent for this ledger entry
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const fullRent = quantity * rate * totalDays;

      // Add to total revenue (sum of all ledger entry rents)
      totalRevenue += fullRent;

      // Now allocate this rent to billing months
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth();

      // Track daily inventory for ending inventory calculation
      const dailyInventory = new Map<string, number>();

      for (let year = startYear; year <= endYear; year++) {
        const monthStart = year === startYear ? startMonth : 0;
        const monthEnd = year === endYear ? endMonth : 11;

        for (let month = monthStart; month <= monthEnd; month++) {
          const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
          const monthFirstDay = new Date(year, month, 1);
          const monthLastDay = new Date(year, month + 1, 0);

          let periodStart = monthFirstDay;
          let periodEnd = monthLastDay;

          // Adjust for start date
          if (year === startYear && month === startMonth) {
            periodStart = startDate;
          }

          // Adjust for end date
          if (year === endYear && month === endMonth) {
            periodEnd = endDate;
          }

          // Ensure periodStart is not before the overall start date
          if (year === startYear && month === startMonth && periodStart < startDate) {
            periodStart = startDate;
          }

          // Ensure periodEnd is not after the overall end date
          if (year === endYear && month === endMonth && periodEnd > endDate) {
            periodEnd = endDate;
          }

          if (periodStart <= periodEnd) {
            const daysInMonth = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

            if (daysInMonth > 0) {
              // Calculate proportional rent for this month
              const monthlyRent = fullRent * (daysInMonth / totalDays);
              const mapKey = `${warehouseIdStr}-${monthKey}`;

              if (!monthlyData.has(mapKey)) {
                monthlyData.set(mapKey, {
                  warehouseId: entry.warehouseId,
                  warehouseName: warehouseMap.get(warehouseIdStr) || 'Unknown',
                  month: monthKey,
                  totalRevenue: 0,
                  totalDays: 0,
                  ledgerCount: 0,
                  totalQuantityDays: 0,
                  avgQuantityMT: 0,
                  endingInventory: 0,
                  dailyInventory: new Map()
                });
              }

              const data = monthlyData.get(mapKey);
              data.totalRevenue += monthlyRent;
              data.totalDays += daysInMonth;
              data.ledgerCount += 1;
              data.totalQuantityDays += quantity * daysInMonth;

              // Track daily inventory for this month
              for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
                const dateKey = d.toISOString().split('T')[0];
                data.dailyInventory.set(dateKey, (data.dailyInventory.get(dateKey) || 0) + quantity);
              }
            }
          }
        }
      }
    });

    // Calculate ending inventory as max daily inventory for each month
    monthlyData.forEach((data) => {
      const inventoryValues = Array.from(data.dailyInventory.values()) as number[];
      const maxInventory = inventoryValues.length > 0 ? Math.max(...inventoryValues) : 0;
      data.endingInventory = maxInventory;
      data.avgQuantityMT = data.totalDays > 0 ? data.totalQuantityDays / data.totalDays : 0;
    });

    // Format results
    const monthlyWarehouseRevenue = Array.from(monthlyData.values())
      .map(item => ({
        warehouseId: item.warehouseId.toString(),
        warehouseName: item.warehouseName,
        month: item.month,
        totalDays: item.totalDays,
        totalQuantityDays: Math.round(item.totalQuantityDays * 100) / 100,
        avgQuantityMT: Math.round(item.avgQuantityMT * 100) / 100,
        endingInventory: Math.round(item.endingInventory * 100) / 100,
        ledgerCount: item.ledgerCount,
        totalRevenue: Math.round(item.totalRevenue * 100) / 100,
        ownerShare: Math.round(item.totalRevenue * 0.6 * 100) / 100,
        platformShare: Math.round(item.totalRevenue * 0.4 * 100) / 100,
        year: item.month.split('-')[0]
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    totalRevenue = Math.round(totalRevenue * 100) / 100;
    const ownerEarnings = Math.round(totalRevenue * 0.6 * 100) / 100;
    const platformCommissions = Math.round(totalRevenue * 0.4 * 100) / 100;

    const summary = {
      totalRevenue,
      ownerEarnings,
      platformCommissions
    };

    console.log('[getRevenueAnalyticsFromInvoices] Summary:', summary);
    console.log('[getRevenueAnalyticsFromInvoices] Monthly revenue entries:', monthlyWarehouseRevenue.length);

    // Get recent logs from revenue distribution
    const recentLogs = await db.collection('revenue_distribution_logs')
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    return {
      summary,
      monthlyWarehouseRevenue,
      recentLogs: recentLogs || []
    };
  } catch (error: any) {
    console.error('[getRevenueAnalyticsFromInvoices] Error:', error);
    return {
      summary: { totalRevenue: 0, ownerEarnings: 0, platformCommissions: 0 },
      monthlyWarehouseRevenue: [],
      recentLogs: []
    };
  }
}
