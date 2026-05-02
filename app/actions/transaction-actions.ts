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
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantFilterForMongo, appendOwnershipForMongo, requireSession } from '@/lib/ownership';

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
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function getMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getLedgerEntryDateRange(entry: any, outwardDate?: Date): { startDate: Date; endDate: Date } {
  const startDate = parseIsoDate(entry.periodStartDate) || new Date();
  let endDate = parseIsoDate(entry.periodEndDate);

  if (!endDate) {
    const daysStored = typeof entry.daysStored === 'number' ? entry.daysStored : 0;
    if (daysStored > 0) {
      endDate = addDays(startDate, daysStored - 1);
    }
  }

  if (!endDate) {
    endDate = new Date(startDate);
  }

  if (outwardDate && outwardDate >= startDate && outwardDate < endDate) {
    endDate = outwardDate;
  }

  return { startDate, endDate };
}

function getDailyRateForEntry(entry: any, commodityRateMap: Map<string, number>): number {
  if (typeof entry.ratePerMTPerDay === 'number' && entry.ratePerMTPerDay > 0) {
    return entry.ratePerMTPerDay;
  }

  const commodityId = entry.commodityId?.toString?.();
  if (commodityId && commodityRateMap.has(commodityId)) {
    return commodityRateMap.get(commodityId) || 10;
  }

  return 10;
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
  const authSession = await requireSession();
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
    const inwardPayload = appendOwnershipForMongo({
      ...data,
      date: inwardDate,
      outwardDate: outwardDate,
    }, authSession);

    const [newInward] = session
      ? await Inward.create([inwardPayload], createOptions)
      : await Inward.create([inwardPayload]);

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
    const inwardTransaction = appendOwnershipForMongo({
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
    }, authSession);

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not established');

    await db.collection('transactions').insertOne(
      inwardTransaction,
      session ? { session } : undefined
    );

    // 3. Financial Calculations
    const monthlyRate = commodity.ratePerMtPerDay * 30; // Convert daily rate to monthly
    const rent = calculateRent(data.quantityMT, monthlyRate, inwardDate, outwardDate);
    const totalAmount = rent.totalAmount;
    
    // 5. Create Ledger Entry for Invoice Generation
    const ratePerMTPerDay =
      commodity.ratePerMtPerDay ??
      (commodity.ratePerMtMonth ? commodity.ratePerMtMonth / 30 : 10);
    const ledgerEntry = {
      clientId: new mongoose.Types.ObjectId(data.clientId),
      warehouseId: new mongoose.Types.ObjectId(data.warehouseId),
      commodityId: new mongoose.Types.ObjectId(data.commodityId),
      periodStartDate: inwardDate.toISOString().split('T')[0],
      periodEndDate: outwardDate.toISOString().split('T')[0],
      quantityMT: data.quantityMT,
      status: 'ACTIVE',
      ratePerMTPerDay: ratePerMTPerDay,
      rentCalculated: totalAmount,
      version: 1,
      createdAt: new Date(),
    };

    await db.collection('ledger_entries').insertOne(
      ledgerEntry,
      session ? { session } : undefined
    );
    const ownerShare = Math.round(totalAmount * 0.6 * 100) / 100;
    const platformShare = Math.round((totalAmount - ownerShare) * 100) / 100;

    const distributionPayload = appendOwnershipForMongo({
      inwardId: newInward._id,
      clientId: data.clientId,
      warehouseId: data.warehouseId,
      totalAmount,
      ownerShare,
      platformShare,
    }, authSession);

    if (session) {
      await RevenueDistribution.create([distributionPayload], { session });
    } else {
      await RevenueDistribution.create([distributionPayload]);
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
  const authSession = await requireSession();
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

    const outwardPayload = appendOwnershipForMongo({
      ...data,
      date: outwardDate,
    }, authSession);

    const [newOutward] = session
      ? await Outward.create([outwardPayload], { session })
      : await Outward.create([outwardPayload]);

    const outwardTransaction = appendOwnershipForMongo({
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
    }, authSession);

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
 * Get warehouse-level revenue analytics by reading directly from revenuedistributions.
 * Groups by warehouse and month using pre-computed owner/platform shares.
 */
/**
 * Get warehouse-level revenue analytics by calculating directly from transactions.
 * This is the most accurate way as it accounts for actual storage duration and withdrawals.
 */
export async function getClientRevenueAnalytics(warehouseId?: string, month?: string) {
  try {
    console.log('[getClientRevenueAnalytics] Starting accurate revenue calculation from transactions...');
    await connectToDatabase();

    let authSession;
    try {
      authSession = await requireSession();
    } catch (error) {
      console.log('[getClientRevenueAnalytics] No session, proceeding without tenant filter');
    }

    const tenantFilter = authSession ? getTenantFilterForMongo(authSession) : {};
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not established');

    // 1. Find relevant warehouses
    const warehouseQuery: any = { ...tenantFilter };
    if (warehouseId && warehouseId !== 'ALL') {
      try { warehouseQuery._id = new mongoose.Types.ObjectId(warehouseId); } catch { /* skip */ }
    }
    const warehouses = await db.collection('warehouses').find(warehouseQuery).toArray();
    const warehouseIds = warehouses.map(w => w._id.toString());
    const warehouseMap = new Map(warehouses.map(w => [w._id.toString(), w]));

    if (!warehouseIds.length) {
      return { summary: { totalRevenue: 0, ownerEarnings: 0, platformCommissions: 0 }, warehouseRevenue: [] };
    }

    // 2. Find all transactions for these warehouses
    const transactions = await db.collection('transactions')
      .find({ warehouseId: { $in: warehouseIds } })
      .sort({ date: 1 })
      .toArray();

    if (!transactions.length) {
      return { summary: { totalRevenue: 0, ownerEarnings: 0, platformCommissions: 0 }, warehouseRevenue: [] };
    }

    // 3. Fetch all commodities for rates
    const commodityIds = [...new Set(transactions.map(t => t.commodityId))];
    const commodities = await db.collection('commodities')
      .find({ _id: { $in: commodityIds.map(id => {
        try { return new mongoose.Types.ObjectId(id); } catch { return null; }
      }).filter(id => id !== null) } })
      .toArray();
    const commodityMap = new Map(commodities.map(c => [c._id.toString(), c]));

    // 4. Group transactions by Unique Stock Key: Client + Commodity + Warehouse
    const groups = new Map<string, any[]>();
    transactions.forEach(t => {
      const key = `${t.clientId}_${t.commodityId}_${t.warehouseId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push({
        date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : t.date,
        type: t.direction || t.type,
        qty: Number(t.quantityMT || 0),
        clientId: t.clientId,
        commodityId: t.commodityId,
        warehouseId: t.warehouseId
      });
    });

    // 5. Calculate Rent Periods for each group
    const { generateStoragePeriods } = await import('@/lib/storage-engine');
    
    // Structure to hold final results: WarehouseID -> MonthKey -> totalRent
    const results = new Map<string, Map<string, number>>();

    groups.forEach((txns, key) => {
      const [clientId, commodityId, wId] = key.split('_');
      const commodity = commodityMap.get(commodityId);
      const rate = commodity?.ratePerMtPerDay || 10;
      
      // Calculate periods (scoped to selected month if provided)
      const periods = generateStoragePeriods(txns, month === 'ALL' ? undefined : month, rate);
      
      periods.forEach(period => {
        const monthKey = period.fromDate.slice(0, 7); // YYYY-MM
        
        if (!results.has(wId)) results.set(wId, new Map());
        const wResults = results.get(wId)!;
        
        wResults.set(monthKey, (wResults.get(monthKey) || 0) + period.rent);
      });
    });

    // 6. Format for Frontend
    const warehouseRevenue = Array.from(results.entries()).map(([wId, months]) => {
      const warehouse = warehouseMap.get(wId);
      const monthlyCharges: Record<string, number> = {};
      let totalWarehouseRevenue = 0;

      months.forEach((rent, month) => {
        const roundedRent = Math.round(rent * 100) / 100;
        monthlyCharges[month] = roundedRent;
        totalWarehouseRevenue += roundedRent;
      });

      const ownerShare = Math.round(totalWarehouseRevenue * 0.6 * 100) / 100;
      const platformShare = Math.round(totalWarehouseRevenue * 0.4 * 100) / 100;

      return {
        warehouseId: wId,
        warehouseName: warehouse?.name || 'Unknown Warehouse',
        monthlyCharges,
        totalRevenue: Math.round(totalWarehouseRevenue * 100) / 100,
        ownerShare,
        platformShare
      };
    }).sort((a, b) => a.warehouseName.localeCompare(b.warehouseName));

    // Calculate Global Summary
    const totalRevenue = warehouseRevenue.reduce((sum, r) => sum + r.totalRevenue, 0);
    const ownerEarnings = warehouseRevenue.reduce((sum, r) => sum + r.ownerShare, 0);
    const platformCommissions = warehouseRevenue.reduce((sum, r) => sum + r.platformShare, 0);

    const summary = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      ownerEarnings: Math.round(ownerEarnings * 100) / 100,
      platformCommissions: Math.round(platformCommissions * 100) / 100,
    };

    console.log(`[getClientRevenueAnalytics] Calculation complete. Total Revenue: ${summary.totalRevenue}`);
    return { summary, warehouseRevenue };

  } catch (error: any) {
    console.error('[getClientRevenueAnalytics] Error:', error?.message || error);
    return { summary: { totalRevenue: 0, ownerEarnings: 0, platformCommissions: 0 }, warehouseRevenue: [] };
  }
}


