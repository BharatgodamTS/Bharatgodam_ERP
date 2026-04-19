const { getClientInvoicesByClientId } = require('./src/app/actions/reports.ts');

async function testWarehouseFilter() {
  try {
    console.log('Testing warehouse filter functionality...');

    // Use the ObjectId for 'Shruti Mehata' client
    const clientId = '69e0c97dcaec663cd7815772';

    // Test with warehouse filter - filter by 'Warehouse ABC'
    console.log('Testing with warehouse filter: Warehouse ABC');
    const result = await getClientInvoicesByClientId(clientId, '2026-01', 'Warehouse ABC');
    console.log('Warehouse filter result:', result.success ? `Found ${result.data.length} invoices` : result.message);

    // Test without warehouse filter (should return all)
    console.log('Testing without warehouse filter (ALL)');
    const resultAll = await getClientInvoicesByClientId(clientId, '2026-01');
    console.log('All warehouses result:', resultAll.success ? `Found ${resultAll.data.length} invoices` : resultAll.message);

    // Test with different warehouse
    console.log('Testing with warehouse filter: Warehouse XYZ');
    const resultXYZ = await getClientInvoicesByClientId(clientId, '2026-01', 'Warehouse XYZ');
    console.log('Warehouse XYZ filter result:', resultXYZ.success ? `Found ${resultXYZ.data.length} invoices` : resultXYZ.message);

    console.log('Warehouse filter test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testWarehouseFilter();