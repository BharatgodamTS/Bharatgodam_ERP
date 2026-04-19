const http = require('http');

async function testMasterDataAPIs() {
  console.log('=== Testing Master Data API Endpoints ===\n');

  const baseURL = 'http://localhost:3000';

  async function makeRequest(path, method = 'GET') {
    return new Promise((resolve, reject) => {
      const url = new URL(baseURL + path);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              data: JSON.parse(data)
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              data: data
            });
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  try {
    // Test clients endpoint
    console.log('1. Testing /api/clients endpoint...');
    const clientsRes = await makeRequest('/api/clients');
    if (clientsRes.status === 200 && clientsRes.data.success) {
      console.log('✅ Clients API working');
      console.log('   - Clients loaded:', clientsRes.data.clients?.length);
      if (clientsRes.data.clients?.length > 0) {
        console.log('   - Sample:', clientsRes.data.clients[0].name);
      }
    } else {
      console.log('❌ Clients API failed:', clientsRes.status, clientsRes.data.message);
    }

    // Test commodities endpoint
    console.log('\n2. Testing /api/commodities endpoint...');
    const commoditiesRes = await makeRequest('/api/commodities');
    if (commoditiesRes.status === 200 && commoditiesRes.data.success) {
      console.log('✅ Commodities API working');
      console.log('   - Commodities loaded:', commoditiesRes.data.commodities?.length);
      if (commoditiesRes.data.commodities?.length > 0) {
        console.log('   - Sample:', commoditiesRes.data.commodities[0].name);
      }
    } else {
      console.log('❌ Commodities API failed:', commoditiesRes.status, commoditiesRes.data.message);
    }

    // Test warehouses endpoint
    console.log('\n3. Testing /api/warehouses endpoint...');
    const warehousesRes = await makeRequest('/api/warehouses');
    if (warehousesRes.status === 200 && warehousesRes.data.success) {
      console.log('✅ Warehouses API working');
      console.log('   - Warehouses loaded:', warehousesRes.data.warehouses?.length);
      if (warehousesRes.data.warehouses?.length > 0) {
        console.log('   - Sample:', warehousesRes.data.warehouses[0].name);
      }
    } else {
      console.log('❌ Warehouses API failed:', warehousesRes.status, warehousesRes.data.message);
    }

    console.log('\n=== Test Summary ===');
    const allPass = clientsRes.status === 200 && commoditiesRes.status === 200 && warehousesRes.status === 200;
    if (allPass) {
      console.log('✅ All master data APIs are accessible');
      console.log('\nForm dropdown loading should now work!');
      console.log('Users can now see and select clients, commodities, and warehouses.');
    } else {
      console.log('❌ Some APIs are not working correctly');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMasterDataAPIs();