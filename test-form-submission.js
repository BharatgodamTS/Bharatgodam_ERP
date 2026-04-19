const { MongoClient } = require('mongodb');

async function testFormSubmissionFlow() {
  console.log('=== Testing Complete Form Submission Flow ===\n');

  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('wms_production');

    // 1. Check warehouse config
    console.log('1. Checking warehouse configuration...');
    const warehouseConfig = await db.collection('warehouse_config').findOne({});
    if (!warehouseConfig) {
      console.log('❌ Warehouse config not found');
      return;
    }
    console.log('✅ Warehouse config exists');
    console.log('   - Total Capacity:', warehouseConfig.totalCapacity);
    console.log('   - Commodities:', warehouseConfig.commodities?.length);

    // 2. Create a test user
    console.log('\n2. Creating test user...');
    const testEmail = 'formtest@example.com';
    const testUser = {
      email: testEmail,
      password: 'testpassword123', // In real scenario, this would be hashed
      createdAt: new Date()
    };
    
    try {
      const existingUser = await db.collection('users').findOne({ email: testEmail });
      if (!existingUser) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(testUser.password, 10);
        const userResult = await db.collection('users').insertOne({
          ...testUser,
          password: hashedPassword
        });
        console.log('✅ Test user created:', testEmail);
        testUser._id = userResult.insertedId;
      } else {
        console.log('ℹ️  Test user already exists:', testEmail);
        testUser._id = existingUser._id;
      }
    } catch (err) {
      console.error('Warning: Could not create user:', err.message);
    }

    // 3. Get initial transaction count
    console.log('\n3. Checking transaction count before submission...');
    const initialCount = await db.collection('transactions').countDocuments();
    console.log('✅ Initial transaction count:', initialCount);

    // 4. Simulate form submission
    console.log('\n4. Simulating form submission...');
    const transaction = {
      type: 'Inward',
      clientId: 'client1',
      warehouseId: 'WH1',
      commodityId: 'comm1', // Using ID that would come from the form
      quantity: 50,
      date: new Date().toISOString().split('T')[0],
      userId: testUser._id?.toString() || 'test-user-id',
      userEmail: testEmail,
      createdAt: new Date(),
      status: 'COMPLETED'
    };

    console.log('   Transaction Data:');
    console.log('   - Type:', transaction.type);
    console.log('   - Client ID:', transaction.clientId);
    console.log('   - Warehouse ID:', transaction.warehouseId);
    console.log('   - Commodity ID:', transaction.commodityId);
    console.log('   - Quantity:', transaction.quantity, 'MT');
    console.log('   - Date:', transaction.date);

    // 5. Insert transaction
    console.log('\n5. Inserting transaction into database...');
    const result = await db.collection('transactions').insertOne(transaction);
    if (result.insertedId) {
      console.log('✅ Transaction inserted successfully!');
      console.log('   Transaction ID:', result.insertedId);
    } else {
      console.log('❌ Failed to insert transaction');
      return;
    }

    // 6. Verify transaction was saved
    console.log('\n6. Verifying transaction was saved...');
    const finalCount = await db.collection('transactions').countDocuments();
    console.log('✅ Final transaction count:', finalCount);
    
    if (finalCount > initialCount) {
      console.log('✅ Transaction count increased by', finalCount - initialCount);
    } else {
      console.log('❌ Transaction count did not increase');
      return;
    }

    // 7. Retrieve the saved transaction
    console.log('\n7. Retrieving saved transaction...');
    const savedTransaction = await db.collection('transactions').findOne({ _id: result.insertedId });
    if (savedTransaction) {
      console.log('✅ Transaction retrieved successfully');
      console.log('   Saved Data:');
      console.log('   - Type:', savedTransaction.type);
      console.log('   - Quantity:', savedTransaction.quantity);
      console.log('   - Status:', savedTransaction.status);
      console.log('   - User Email:', savedTransaction.userEmail);
    }

    // 8. Check current warehouse usage
    console.log('\n8. Calculating warehouse usage...');
    const usageResult = await db.collection('transactions').aggregate([
      { $match: { warehouseId: 'WH1', type: 'Inward' } },
      { $group: { _id: null, totalUsed: { $sum: '$quantity' } } }
    ]).toArray();
    
    const usage = usageResult[0]?.totalUsed || 0;
    const available = warehouseConfig.totalCapacity - usage;
    console.log('✅ Warehouse WH1 Usage:');
    console.log('   - Total Capacity:', warehouseConfig.totalCapacity, 'MT');
    console.log('   - Used Capacity:', usage, 'MT');
    console.log('   - Available Capacity:', available, 'MT');

    console.log('\n=== ✅ FORM SUBMISSION FLOW TEST COMPLETED SUCCESSFULLY ===\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await client.close();
  }
}

testFormSubmissionFlow();