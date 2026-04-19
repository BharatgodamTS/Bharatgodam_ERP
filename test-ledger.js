const { MongoClient, ObjectId } = require('mongodb');

async function testStockLedger() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('wms_production');

  // Create stock entry inward
  const inwardEntry = {
    clientId: new ObjectId('69e0c97dcaec663cd7815772'),
    warehouseId: new ObjectId('69e0c97dcaec663cd7815776'),
    commodityId: new ObjectId('69e0c97dcaec663cd7815774'),
    direction: 'INWARD',
    quantityMT: 100,
    inwardDate: '2026-01-10',
    expectedOutwardDate: '2026-03-20',
    ratePerMTPerDay: 10,
    gatePass: 'GP001',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const inwardResult = await db.collection('stock_entries').insertOne(inwardEntry);
  console.log('Inward inserted:', inwardResult.insertedId);

  // Create ledger entry
  const ledgerEntry = {
    stockEntryId: inwardResult.insertedId,
    clientId: inwardEntry.clientId,
    warehouseId: inwardEntry.warehouseId,
    commodityId: inwardEntry.commodityId,
    periodStartDate: inwardEntry.inwardDate,
    periodEndDate: inwardEntry.expectedOutwardDate,
    quantityMT: inwardEntry.quantityMT,
    status: 'ACTIVE',
    ratePerMTPerDay: inwardEntry.ratePerMTPerDay,
    version: 1,
    createdAt: new Date(),
  };

  await db.collection('ledger_entries').insertOne(ledgerEntry);
  console.log('Ledger entry created');

  // Now outward
  const outwardEntry = {
    clientId: inwardEntry.clientId,
    warehouseId: inwardEntry.warehouseId,
    commodityId: inwardEntry.commodityId,
    direction: 'OUTWARD',
    quantityMT: 30,
    inwardDate: '2026-01-15',
    actualOutwardDate: '2026-01-20',
    ratePerMTPerDay: 10,
    gatePass: 'GP002',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const outwardResult = await db.collection('stock_entries').insertOne(outwardEntry);
  console.log('Outward inserted:', outwardResult.insertedId);

  // Update ledger: split the entry
  const activeLedger = await db.collection('ledger_entries').findOne({
    clientId: inwardEntry.clientId,
    warehouseId: inwardEntry.warehouseId,
    commodityId: inwardEntry.commodityId,
    status: 'ACTIVE',
  });

  if (activeLedger) {
    // Close portion
    const closedEntry = {
      stockEntryId: activeLedger.stockEntryId,
      clientId: activeLedger.clientId,
      warehouseId: activeLedger.warehouseId,
      commodityId: activeLedger.commodityId,
      periodStartDate: activeLedger.periodStartDate,
      periodEndDate: outwardEntry.actualOutwardDate,
      quantityMT: outwardEntry.quantityMT,
      status: 'CLOSED',
      ratePerMTPerDay: activeLedger.ratePerMTPerDay,
      version: activeLedger.version + 1,
      changeReason: 'Partial outward',
      previousEntryId: activeLedger._id,
      createdAt: new Date(),
    };

    // Remaining
    const remainingEntry = {
      stockEntryId: activeLedger.stockEntryId,
      clientId: activeLedger.clientId,
      warehouseId: activeLedger.warehouseId,
      commodityId: activeLedger.commodityId,
      periodStartDate: outwardEntry.actualOutwardDate,
      periodEndDate: activeLedger.periodEndDate,
      quantityMT: activeLedger.quantityMT - outwardEntry.quantityMT,
      status: 'ACTIVE',
      ratePerMTPerDay: activeLedger.ratePerMTPerDay,
      version: activeLedger.version + 1,
      changeReason: 'Partial outward remainder',
      previousEntryId: activeLedger._id,
      createdAt: new Date(),
    };

    await db.collection('ledger_entries').insertMany([closedEntry, remainingEntry]);

    // Mark original as split
    await db.collection('ledger_entries').updateOne(
      { _id: activeLedger._id },
      { $set: { status: 'SPLIT', updatedAt: new Date() } }
    );

    console.log('Ledger split completed');
  }

  // Check final ledger
  const finalLedger = await db.collection('ledger_entries').find({
    clientId: inwardEntry.clientId,
    warehouseId: inwardEntry.warehouseId,
    commodityId: inwardEntry.commodityId,
  }).sort({ periodStartDate: 1 }).toArray();

  console.log('Final ledger entries:', finalLedger.map(l => ({
    start: l.periodStartDate,
    end: l.periodEndDate,
    qty: l.quantityMT,
    status: l.status,
  })));

  await client.close();
}

testStockLedger().catch(console.error);