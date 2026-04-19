'use server';

import { getDb } from '@/lib/mongodb';
import type { IStockEntry, ILedgerEntry, IInvoiceMaster, IInvoiceLineItem, IClient, ICommodity, IWarehouse } from '@/types/schemas';
import { ObjectId } from 'mongodb';

/**
 * Get master data for dropdowns
 */
export async function getMasterData() {
  const db = await getDb();

  const [clients, commodities, warehouses] = await Promise.all([
    db.collection('clients').find({ status: 'ACTIVE' }).toArray(),
    db.collection('commodities').find({}).toArray(),
    db.collection('warehouses').find({ status: 'ACTIVE' }).toArray(),
  ]);

  return {
    clients: clients as IClient[],
    commodities: commodities as ICommodity[],
    warehouses: warehouses as IWarehouse[],
  };
}
export async function createStockEntry(data: {
  clientId: string;
  warehouseId: string;
  commodityId: string;
  direction: 'INWARD' | 'OUTWARD';
  quantityMT: number;
  bagsCount?: number;
  inwardDate: string;
  expectedOutwardDate?: string;
  actualOutwardDate?: string;
  ratePerMTPerDay: number;
  gatePass?: string;
  remarks?: string;
}): Promise<{ success: boolean; stockEntry?: IStockEntry; message?: string }> {
  try {
    const db = await getDb();

    // Validate references
    const client = await db.collection('clients').findOne({ _id: new ObjectId(data.clientId) });
    if (!client) return { success: false, message: 'Client not found' };

    const warehouse = await db.collection('warehouses').findOne({ _id: new ObjectId(data.warehouseId) });
    if (!warehouse) return { success: false, message: 'Warehouse not found' };

    const commodity = await db.collection('commodities').findOne({ _id: new ObjectId(data.commodityId) });
    if (!commodity) return { success: false, message: 'Commodity not found' };

    // For outward, check if stock exists
    if (data.direction === 'OUTWARD') {
      const currentStock = await getCurrentStock(data.clientId, data.warehouseId, data.commodityId);
      if (currentStock < data.quantityMT) {
        return { success: false, message: 'Insufficient stock for outward' };
      }
    }

    const stockEntry: IStockEntry = {
      clientId: new ObjectId(data.clientId),
      warehouseId: new ObjectId(data.warehouseId),
      commodityId: new ObjectId(data.commodityId),
      direction: data.direction,
      quantityMT: data.quantityMT,
      bagsCount: data.bagsCount,
      inwardDate: data.inwardDate,
      expectedOutwardDate: data.expectedOutwardDate,
      actualOutwardDate: data.actualOutwardDate,
      ratePerMTPerDay: data.ratePerMTPerDay,
      gatePass: data.gatePass,
      remarks: data.remarks,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('stock_entries').insertOne(stockEntry);

    // Update ledger
    await updateLedgerForStockEntry({ ...stockEntry, _id: result.insertedId });

    // Update warehouse capacity for inward
    if (data.direction === 'INWARD') {
      await db.collection('warehouses').updateOne(
        { _id: new ObjectId(data.warehouseId) },
        { $inc: { occupiedCapacity: data.quantityMT } }
      );
    }

    return { success: true, stockEntry: { ...stockEntry, _id: result.insertedId } };
  } catch (error: any) {
    console.error('createStockEntry error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Get current stock balance for client + warehouse + commodity
 */
export async function getCurrentStock(clientId: string, warehouseId: string, commodityId: string): Promise<number> {
  const db = await getDb();

  const inwardResult = await db.collection('stock_entries').aggregate([
    {
      $match: {
        clientId: new ObjectId(clientId),
        warehouseId: new ObjectId(warehouseId),
        commodityId: new ObjectId(commodityId),
        direction: 'INWARD',
        status: 'ACTIVE',
      },
    },
    { $group: { _id: null, total: { $sum: '$quantityMT' } } },
  ]).toArray();

  const outwardResult = await db.collection('stock_entries').aggregate([
    {
      $match: {
        clientId: new ObjectId(clientId),
        warehouseId: new ObjectId(warehouseId),
        commodityId: new ObjectId(commodityId),
        direction: 'OUTWARD',
        status: 'ACTIVE',
      },
    },
    { $group: { _id: null, total: { $sum: '$quantityMT' } } },
  ]).toArray();

  const totalInward = inwardResult[0]?.total || 0;
  const totalOutward = outwardResult[0]?.total || 0;

  return totalInward - totalOutward;
}

/**
 * Update ledger entries for a stock entry
 * This implements the time-state system
 */
async function updateLedgerForStockEntry(stockEntry: IStockEntry): Promise<void> {
  const db = await getDb();

  if (stockEntry.direction === 'INWARD') {
    // For inward, create initial ledger entry from inward date to expected outward or ongoing
    const endDate = stockEntry.expectedOutwardDate || null;

    const ledgerEntry: ILedgerEntry = {
      stockEntryId: stockEntry._id!,
      clientId: stockEntry.clientId,
      warehouseId: stockEntry.warehouseId,
      commodityId: stockEntry.commodityId,
      periodStartDate: stockEntry.inwardDate,
      periodEndDate: endDate,
      quantityMT: stockEntry.quantityMT,
      status: endDate ? 'ACTIVE' : 'ACTIVE', // ACTIVE if has end date, else ongoing
      ratePerMTPerDay: stockEntry.ratePerMTPerDay,
      version: 1,
      createdAt: new Date(),
    };

    await db.collection('ledger_entries').insertOne(ledgerEntry);
  } else {
    // For outward, close ledger entries and split if necessary
    await processOutwardLedgerUpdate(stockEntry);
  }
}

/**
 * Process outward and update ledger (split periods)
 */
async function processOutwardLedgerUpdate(outwardEntry: IStockEntry): Promise<void> {
  const db = await getDb();

  // Find active ledger entries for this client/warehouse/commodity
  const activeEntries = await db.collection('ledger_entries').find({
    clientId: outwardEntry.clientId,
    warehouseId: outwardEntry.warehouseId,
    commodityId: outwardEntry.commodityId,
    status: 'ACTIVE',
  }).sort({ periodStartDate: 1 }).toArray();

  let remainingOutward = outwardEntry.quantityMT;
  const outwardDate = outwardEntry.actualOutwardDate || outwardEntry.inwardDate; // Use actual or inward date

  for (const entry of activeEntries) {
    if (remainingOutward <= 0) break;

    const entryQuantity = entry.quantityMT;

    if (remainingOutward >= entryQuantity) {
      // Close this entry completely
      await db.collection('ledger_entries').updateOne(
        { _id: entry._id },
        {
          $set: {
            periodEndDate: outwardDate,
            status: 'CLOSED',
            changeReason: 'Full outward',
            updatedAt: new Date(),
          },
        }
      );
      remainingOutward -= entryQuantity;
    } else {
      // Split the entry
      // Close the portion up to outward date
      const closedEntry: ILedgerEntry = {
        stockEntryId: entry.stockEntryId,
        clientId: entry.clientId,
        warehouseId: entry.warehouseId,
        commodityId: entry.commodityId,
        periodStartDate: entry.periodStartDate,
        periodEndDate: outwardDate,
        quantityMT: remainingOutward,
        status: 'CLOSED',
        ratePerMTPerDay: entry.ratePerMTPerDay,
        version: entry.version + 1,
        changeReason: 'Partial outward',
        previousEntryId: entry._id,
        createdAt: new Date(),
      };

      // Remaining portion continues
      const remainingEntry: ILedgerEntry = {
        stockEntryId: entry.stockEntryId,
        clientId: entry.clientId,
        warehouseId: entry.warehouseId,
        commodityId: entry.commodityId,
        periodStartDate: outwardDate,
        periodEndDate: entry.periodEndDate,
        quantityMT: entryQuantity - remainingOutward,
        status: entry.periodEndDate ? 'ACTIVE' : 'ACTIVE',
        ratePerMTPerDay: entry.ratePerMTPerDay,
        version: entry.version + 1,
        changeReason: 'Partial outward remainder',
        previousEntryId: entry._id,
        createdAt: new Date(),
      };

      await db.collection('ledger_entries').insertMany([closedEntry, remainingEntry]);

      // Mark original as split
      await db.collection('ledger_entries').updateOne(
        { _id: entry._id },
        { $set: { status: 'SPLIT', updatedAt: new Date() } }
      );

      remainingOutward = 0;
    }
  }
}

/**
 * Generate monthly invoices for all clients/warehouses
 * Run this at month-end
 */
export async function generateMonthlyInvoices(invoiceMonth: string): Promise<{ success: boolean; message: string }> {
  try {
    const db = await getDb();

    // Get all client-warehouse combinations with active stock
    const combinations = await db.collection('ledger_entries').aggregate([
      { $match: { status: { $in: ['ACTIVE', 'CLOSED'] } } },
      {
        $group: {
          _id: { clientId: '$clientId', warehouseId: '$warehouseId' },
          clientId: { $first: '$clientId' },
          warehouseId: { $first: '$warehouseId' },
        },
      },
    ]).toArray();

    for (const combo of combinations) {
      await generateInvoiceForClientWarehouse(combo.clientId, combo.warehouseId, invoiceMonth);
    }

    return { success: true, message: 'Monthly invoices generated' };
  } catch (error: any) {
    console.error('generateMonthlyInvoices error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Generate invoice for specific client-warehouse-month
 */
async function generateInvoiceForClientWarehouse(clientId: ObjectId, warehouseId: ObjectId, invoiceMonth: string): Promise<void> {
  const db = await getDb();

  // Calculate days occupied per commodity for the month
  const monthStart = `${invoiceMonth}-01`;
  const monthEnd = new Date(invoiceMonth + '-01');
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0); // Last day of month
  const monthEndStr = monthEnd.toISOString().split('T')[0];

  const ledgerQuery: any = {
    status: { $in: ['ACTIVE', 'CLOSED'] },
    periodStartDate: { $lte: monthEndStr },
    $or: [
      { periodEndDate: { $gte: monthStart } },
      { periodEndDate: null },
    ],
  };

  try {
    ledgerQuery.$and = [
      {
        $or: [
          { clientId },
          { clientId: clientId.toString() },
        ],
      },
      {
        $or: [
          { warehouseId },
          { warehouseId: warehouseId.toString() },
        ],
      },
    ];
  } catch {
    ledgerQuery.clientId = clientId;
    ledgerQuery.warehouseId = warehouseId;
  }

  // Query ledger entries for this client+warehouse during the invoice month
  const ledgerData = await db.collection('ledger_entries').aggregate([
    {
      $match: {
        clientId,
        warehouseId,
        status: { $in: ['ACTIVE', 'CLOSED'] },
        periodStartDate: { $lte: monthEndStr },
        $or: [
          { periodEndDate: { $gte: monthStart } },
          { periodEndDate: null },
        ],
      },
    },
    {
      $lookup: {
        from: 'commodities',
        localField: 'commodityId',
        foreignField: '_id',
        as: 'commodity',
      },
    },
    { $unwind: { path: '$commodity', preserveNullAndEmptyArrays: true } },
  ]).toArray();

  // Check if invoice already exists
  const existingMaster = await db.collection('invoice_master').findOne({
    clientId,
    warehouseId,
    invoiceMonth,
  });

  if (existingMaster) {
    return;
  }

  // Only create invoice if ledger entries exist for this month
  if (ledgerData.length === 0) return;

  let totalAmount = 0;
  const lineItems: IInvoiceLineItem[] = [];

  // Generate line items from ledger entries ONLY - no raw transaction fallbacks
  for (const entry of ledgerData) {
    const start = new Date(Math.max(new Date(entry.periodStartDate).getTime(), new Date(monthStart).getTime()));
    const end = entry.periodEndDate
      ? new Date(Math.min(new Date(entry.periodEndDate).getTime(), new Date(monthEndStr).getTime()))
      : new Date(monthEndStr);

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const amount = days * entry.quantityMT * entry.ratePerMTPerDay;

    totalAmount += amount;

    lineItems.push({
      invoiceMasterId: new ObjectId(), // Will update after creating master
      commodityId: entry.commodityId,
      commodityName: entry.commodity?.name || entry.commodityName || 'Unknown',
      daysOccupied: days,
      averageQuantityMT: entry.quantityMT,
      ratePerMTPerDay: entry.ratePerMTPerDay,
      totalAmount: amount,
      periodStart: start.toISOString().split('T')[0],
      periodEnd: end.toISOString().split('T')[0],
      createdAt: new Date(),
    });
  }

  if (lineItems.length === 0) return;

  // Create invoice master
  const invoiceMaster: IInvoiceMaster = {
    clientId,
    warehouseId,
    invoiceMonth,
    totalAmount,
    status: 'DRAFT',
    generatedAt: new Date(),
    dueDate: new Date(monthEnd.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days after month end
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const masterResult = await db.collection('invoice_master').insertOne(invoiceMaster);

  // Update line items with master ID
  for (const item of lineItems) {
    item.invoiceMasterId = masterResult.insertedId;
  }

  await db.collection('invoice_line_items').insertMany(lineItems);
}

/**
 * Get ledger summary for client-warehouse-commodity
 */
export async function getLedgerSummary(clientId: string, warehouseId: string, commodityId?: string): Promise<any> {
  const db = await getDb();

  const match: any = {
    clientId: new ObjectId(clientId),
    warehouseId: new ObjectId(warehouseId),
  };

  if (commodityId) {
    match.commodityId = new ObjectId(commodityId);
  }

  const entries = await db.collection('ledger_entries').aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'commodities',
        localField: 'commodityId',
        foreignField: '_id',
        as: 'commodity',
      },
    },
    { $unwind: { path: '$commodity', preserveNullAndEmptyArrays: true } },
    { $sort: { periodStartDate: 1 } },
  ]).toArray();

  return entries;
}