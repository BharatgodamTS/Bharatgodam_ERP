const { createStockEntry } = require('./src/app/actions/stock-ledger-actions');

async function testStockEntry() {
  // Sample inward
  const result = await createStockEntry({
    clientId: '69e0c97dcaec663cd7815772', // Shruti Mehata
    warehouseId: '69e0c97dcaec663cd7815776', // Warehouse ABC
    commodityId: '69e0c97dcaec663cd7815774', // WHEAT
    direction: 'INWARD',
    quantityMT: 100,
    inwardDate: '2026-01-10',
    expectedOutwardDate: '2026-03-20',
    ratePerMTPerDay: 10,
    gatePass: 'GP001',
  });

  console.log('Inward Result:', result);

  // Sample outward
  const outwardResult = await createStockEntry({
    clientId: '69e0c97dcaec663cd7815772',
    warehouseId: '69e0c97dcaec663cd7815776',
    commodityId: '69e0c97dcaec663cd7815774',
    direction: 'OUTWARD',
    quantityMT: 30,
    inwardDate: '2026-01-15', // Not used for outward
    actualOutwardDate: '2026-01-20',
    ratePerMTPerDay: 10,
    gatePass: 'GP002',
  });

  console.log('Outward Result:', outwardResult);
}

testStockEntry().catch(console.error);