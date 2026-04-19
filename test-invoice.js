const { MongoClient, ObjectId } = require('mongodb');

async function testInvoiceGeneration() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('wms_production');

  const invoiceMonth = '2026-01';

  // Get ledger entries for January
  const ledgerData = await db.collection('ledger_entries').aggregate([
    {
      $match: {
        status: { $in: ['ACTIVE', 'CLOSED'] },
        periodStartDate: { $lte: '2026-01-31' },
        $or: [
          { periodEndDate: { $gte: '2026-01-01' } },
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
    { $unwind: '$commodity' },
  ]).toArray();

  console.log('Ledger data for Jan:', ledgerData.map(l => ({
    start: l.periodStartDate,
    end: l.periodEndDate,
    qty: l.quantityMT,
    rate: l.ratePerMTPerDay,
    commodity: l.commodity.name,
  })));

  // Calculate for each
  let totalAmount = 0;
  const lineItems = [];

  for (const entry of ledgerData) {
    const start = new Date(Math.max(new Date(entry.periodStartDate).getTime(), new Date('2026-01-01').getTime()));
    const end = entry.periodEndDate
      ? new Date(Math.min(new Date(entry.periodEndDate).getTime(), new Date('2026-01-31').getTime()))
      : new Date('2026-01-31');

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const amount = days * entry.quantityMT * entry.ratePerMTPerDay;

    totalAmount += amount;

    lineItems.push({
      commodityId: entry.commodityId,
      commodityName: entry.commodity.name,
      daysOccupied: days,
      averageQuantityMT: entry.quantityMT,
      ratePerMTPerDay: entry.ratePerMTPerDay,
      totalAmount: amount,
      periodStart: start.toISOString().split('T')[0],
      periodEnd: end.toISOString().split('T')[0],
    });

    console.log(`Entry: ${days} days * ${entry.quantityMT} MT * ₹${entry.ratePerMTPerDay} = ₹${amount}`);
  }

  console.log('Total for Jan:', totalAmount);

  // Create invoice master
  const invoiceMaster = {
    clientId: ledgerData[0].clientId,
    warehouseId: ledgerData[0].warehouseId,
    invoiceMonth,
    totalAmount,
    status: 'DRAFT',
    generatedAt: new Date(),
    dueDate: '2026-02-28',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const masterResult = await db.collection('invoice_master').insertOne(invoiceMaster);
  console.log('Invoice master created:', masterResult.insertedId);

  // Add line items
  for (const item of lineItems) {
    item.invoiceMasterId = masterResult.insertedId;
    item.createdAt = new Date();
  }

  await db.collection('invoice_line_items').insertMany(lineItems);
  console.log('Line items created');

  await client.close();
}

testInvoiceGeneration().catch(console.error);