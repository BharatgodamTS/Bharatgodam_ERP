const { MongoClient } = require('mongodb');

async function testInwardTransaction() {
  console.log('Testing inward transaction database insertion...');

  try {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('wms_production');

    console.log('1. Checking warehouse config...');
    const warehouseConfig = await db.collection('warehouse_config').findOne({});
    if (!warehouseConfig) {
      console.log('❌ Warehouse config not found!');
      return;
    }
    console.log('✅ Warehouse config exists:', warehouseConfig._id);

    console.log('2. Checking current transaction count...');
    const initialCount = await db.collection('transactions').countDocuments();
    console.log('Initial transactions:', initialCount);

    console.log('3. Creating test inward transaction...');
    const transaction = {
      type: 'Inward',
      clientId: '507f1f77bcf86cd799439011',
      warehouseId: '507f1f77bcf86cd799439012',
      commodityId: '507f1f77bcf86cd799439013',
      quantity: 100,
      date: '2024-04-15',
      userId: '69dfd45cca61467ce41dd364',
      userEmail: 'test@example.com',
      createdAt: new Date(),
      status: 'COMPLETED'
    };

    const result = await db.collection('transactions').insertOne(transaction);
    console.log('✅ Transaction inserted with ID:', result.insertedId);

    console.log('4. Verifying transaction was saved...');
    const finalCount = await db.collection('transactions').countDocuments();
    console.log('Final transactions:', finalCount);

    if (finalCount > initialCount) {
      console.log('✅ SUCCESS: Transaction count increased!');
      const savedTransaction = await db.collection('transactions').findOne({ _id: result.insertedId });
      console.log('Saved transaction:', {
        type: savedTransaction.type,
        quantity: savedTransaction.quantity,
        date: savedTransaction.date,
        status: savedTransaction.status
      });
    } else {
      console.log('❌ ERROR: Transaction was not saved!');
    }

    await client.close();
    console.log('✅ Database test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testInwardTransaction();