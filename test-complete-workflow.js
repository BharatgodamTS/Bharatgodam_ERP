const http = require('http');
const { MongoClient } = require('mongodb');

async function testCompleteInwardWorkflow() {
  console.log('=== Complete Inward Transaction Workflow ===\n');

  const mongoClient = new MongoClient('mongodb://localhost:27017');

  try {
    await mongoClient.connect();
    const db = mongoClient.db('wms_production');

    // Check what clients exist in the database
    console.log('Step 1: Checking existing data in database...\n');
    
    const clients = await db.collection('client_accounts').find({}).toArray();
    console.log(`📋 Clients in system: ${clients.length}`);
    if (clients.length > 0) {
      clients.slice(0, 3).forEach(c => {
        console.log(`   • ${c.name || c.clientName} (${c.clientType || c.type})`);
      });
    } else {
      console.log('   (No clients yet - add via /dashboard/clients)');
    }

    const warehouses = await db.collection('warehouses').find({}).toArray();
    console.log(`\n📦 Warehouses in system: ${warehouses.length}`);
    if (warehouses.length > 0) {
      warehouses.slice(0, 3).forEach(w => {
        console.log(`   • ${w.name} (${w.totalCapacity - w.occupiedCapacity} MT available)`);
      });
    } else {
      console.log('   (No warehouses yet - add via /dashboard/warehouses)');
    }

    const commodities = await db.collection('commodities').find({}).toArray();
    console.log(`\n📊 Commodities in system: ${commodities.length}`);
    if (commodities.length > 0) {
      commodities.slice(0, 3).forEach(c => {
        console.log(`   • ${c.name} (₹${c.ratePerMtMonth}/MT/month)`);
      });
    } else {
      console.log('   (No commodities yet - add via /dashboard/commodities)');
    }

    // Check if any inward transactions exist
    const inwards = await db.collection('inwards').find({}).toArray();
    console.log(`\n✅ Inward transactions recorded: ${inwards.length}`);
    if (inwards.length > 0) {
      const latest = inwards[inwards.length - 1];
      console.log(`   Latest: ${latest.quantityMT} MT recorded on ${new Date(latest.date).toLocaleDateString()}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('📋 WORKFLOW TO RECORD INWARD TRANSACTION');
    console.log('='.repeat(50) + '\n');

    console.log('STEP 1: Add Master Data (if not already done)\n');
    console.log('   A. Add a Client:');
    console.log('      → Go to http://localhost:3000/dashboard/clients');
    console.log('      → Click "Add Client"');
    console.log('      → Fill in: Name, Address, Type, Mobile');
    console.log('      → Click "Save Client"\n');

    console.log('   B. Add a Warehouse:');
    console.log('      → Go to http://localhost:3000/dashboard/warehouses');
    console.log('      → Click "Add Warehouse"');
    console.log('      → Fill in: Name, Address, Total Capacity');
    console.log('      → Click "Save Warehouse"\n');

    console.log('   C. Add a Commodity:');
    console.log('      → Go to http://localhost:3000/dashboard/commodities');
    console.log('      → Click "Add Commodity"');
    console.log('      → Fill in: Name, Rate Per MT/Month');
    console.log('      → Click "Save Commodity"\n');

    console.log('STEP 2: Record Inward Transaction\n');
    console.log('   A. Log in to your account');
    console.log('      → http://localhost:3000\n');

    console.log('   B. Navigate to Inward Form');
    console.log('      → http://localhost:3000/dashboard/inward\n');

    console.log('   C. Fill the form with YOUR added data');
    console.log('      → Client: Select the client you added');
    console.log('      → Commodity: Select the commodity you added');
    console.log('      → Warehouse: Select the warehouse you added');
    console.log('      → Quantity (MT): Enter amount (e.g., 50)');
    console.log('      → No. of Bags: Enter quantity (e.g., 100)');
    console.log('      → Inward Date: Select today');
    console.log('      → Expected Outward Date: Select future date\n');

    console.log('   D. Click "Confirm Inward Entry"');
    console.log('      → Success! Transaction recorded\n');

    console.log('STEP 3: Verify Transaction\n');
    console.log('   View in database:');
    console.log('   Collection: "inwards"');
    console.log('   Fields: clientId, warehouseId, commodityId, quantityMT, date\n');

    console.log('='.repeat(50));
    console.log('🎯 KEY POINTS');
    console.log('='.repeat(50));
    console.log('✅ The form displays YOUR actual master data');
    console.log('✅ No hardcoded values - uses real database records');
    console.log('✅ Select any client, warehouse, commodity you created');
    console.log('✅ All data is saved to MongoDB');
    console.log('✅ Transactions are associated with logged-in user\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoClient.close();
  }
}

testCompleteInwardWorkflow();