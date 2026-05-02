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
export async function getClientRevenueAnalytics(warehouseId?: string) {
  try {
    console.log('[getClientRevenueAnalytics] Starting revenue analytics from revenuedistributions...');
    await connectToDatabase();

    let session;
    try {
      session = await requireSession();
    } catch (error) {
      console.log('[getClientRevenueAnalytics] No session, proceeding without tenant filter');
    }

    const tenantFilter = session ? getTenantFilterForMongo(session) : {};
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not established');

    // BUILD ROBUST FILTER: 
    // Instead of just filtering revenue records directly (which might miss userId in legacy data),
    // we find all warehouses the user owns and filter revenue by those warehouse IDs.
    const userWarehouses = await db.collection('warehouses').find(tenantFilter).toArray();
    const userWarehouseIds = userWarehouses.map(w => w._id);

    const revenueFilter: any = {
      warehouseId: { $in: userWarehouseIds }
    };

    if (warehouseId && warehouseId !== 'ALL') {
      try { 
        const targetId = new mongoose.Types.ObjectId(warehouseId);
        // Ensure the filtered warehouse is actually owned by the user
        if (userWarehouseIds.some(id => id.toString() === targetId.toString())) {
          revenueFilter.warehouseId = targetId;
        } else if (userWarehouseIds.length > 0) {
          // If they try to access a warehouse they don't own, force empty result
          return { summary: { totalRevenue: 0, ownerEarnings: 0, platformCommissions: 0 }, warehouseRevenue: [] };
        }
      } catch { /* skip */ }
    }

    // Read directly from revenuedistributions
    const revenueRecords = await db.collection('revenuedistributions').find(revenueFilter).toArray();
    console.log(`[getClientRevenueAnalytics] Found ${revenueRecords.length} revenue records for ${userWarehouseIds.length} owned warehouses`);

    if (!revenueRecords.length) {
      return { summary: { totalRevenue: 0, ownerEarnings: 0, platformCommissions: 0 }, warehouseRevenue: [] };
    }

    // Collect unique IDs for lookups
    const warehouseIdSet = new Set<string>();
    const inwardIdSet = new Set<string>();
    revenueRecords.forEach((r: any) => {
      if (r.warehouseId) warehouseIdSet.add(r.warehouseId.toString());
      if (r.inwardId) inwardIdSet.add(r.inwardId.toString());
    });

    const safeId = (id: string): mongoose.Types.ObjectId | null => {
      try { return new mongoose.Types.ObjectId(id); } catch { return null; }
    };
    const toObjIds = (ids: Set<string>): mongoose.Types.ObjectId[] =>
      Array.from(ids).map(safeId).filter((id): id is mongoose.Types.ObjectId => id !== null);

    // Fetch warehouse names
    const warehouses = await db.collection('warehouses').find({ _id: { $in: toObjIds(warehouseIdSet) } }).toArray();
    const warehouseNameMap = new Map(warehouses.map((w: any) => [w._id.toString(), w.name as string]));

    // Fetch inward dates to determine billing month
    const inwards = await db.collection('inwards').find({ _id: { $in: toObjIds(inwardIdSet) } }).toArray();
    const inwardDateMap = new Map(inwards.map((i: any) => {
      const d = i.date instanceof Date ? i.date : (typeof i.date === 'string' ? new Date(i.date) : null);
      return [i._id.toString(), d ? d.toISOString().slice(0, 7) : null];
    }));

    // Group by warehouse → month
    type WData = { warehouseName: string; monthlyCharges: Map<string, number>; totalRevenue: number; ownerShare: number; platformShare: number };
    const warehouseData = new Map<string, WData>();

    for (const record of revenueRecords) {
      const wId = record.warehouseId?.toString();
      if (!wId) continue;

      const warehouseName = warehouseNameMap.get(wId) || 'Unknown Warehouse';
      let monthKey = 'Unknown';
      if (record.inwardId) {
        monthKey = inwardDateMap.get(record.inwardId.toString()) || monthKey;
      } else if (record.createdAt instanceof Date) {
        monthKey = record.createdAt.toISOString().slice(0, 7);
      } else if (record.timestamp instanceof Date) {
        monthKey = record.timestamp.toISOString().slice(0, 7);
      }

      if (!warehouseData.has(wId)) {
        warehouseData.set(wId, { warehouseName, monthlyCharges: new Map(), totalRevenue: 0, ownerShare: 0, platformShare: 0 });
      }

      const wd = warehouseData.get(wId)!;
      const amount = typeof record.totalAmount === 'number' ? record.totalAmount : 0;
      const owner = typeof record.ownerShare === 'number' ? record.ownerShare : Math.round(amount * 0.6 * 100) / 100;
      const platform = typeof record.platformShare === 'number' ? record.platformShare : Math.round(amount * 0.4 * 100) / 100;

      wd.monthlyCharges.set(monthKey, (wd.monthlyCharges.get(monthKey) || 0) + amount);
      wd.totalRevenue += amount;
      wd.ownerShare += owner;
      wd.platformShare += platform;
    }

    // Convert to array output
    const warehouseRevenue = Array.from(warehouseData.entries()).map(([wId, data]) => {
      const monthlyCharges: Record<string, number> = {};
      data.monthlyCharges.forEach((charge, month) => { monthlyCharges[month] = Math.round(charge * 100) / 100; });
      return {
        warehouseId: wId,
        warehouseName: data.warehouseName,
        monthlyCharges,
        totalRevenue: Math.round(data.totalRevenue * 100) / 100,
        ownerShare: Math.round(data.ownerShare * 100) / 100,
        platformShare: Math.round(data.platformShare * 100) / 100,
      };
    }).sort((a, b) => a.warehouseName.localeCompare(b.warehouseName));

    const totalRevenue = warehouseRevenue.reduce((sum, r) => sum + r.totalRevenue, 0);
    const ownerEarnings = warehouseRevenue.reduce((sum, r) => sum + r.ownerShare, 0);
    const platformCommissions = warehouseRevenue.reduce((sum, r) => sum + r.platformShare, 0);

    const summary = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      ownerEarnings: Math.round(ownerEarnings * 100) / 100,
      platformCommissions: Math.round(platformCommissions * 100) / 100,
    };

    console.log('[getClientRevenueAnalytics] Summary:', summary);
    return { summary, warehouseRevenue };

  } catch (error: any) {
    console.error('[getClientRevenueAnalytics] Error:', error?.message || error);
    return { summary: { totalRevenue: 0, ownerEarnings: 0, platformCommissions: 0 }, warehouseRevenue: [] };
  }
}


