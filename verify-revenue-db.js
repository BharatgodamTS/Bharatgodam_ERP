const { MongoClient } = require('mongodb');

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'wms-app';
const COLLECTION_NAME = 'revenue_distributions';

async function verifyRevenueData() {
  const client = new MongoClient(MONGODB_URL, {
    serverApi: {
      version: '1',
      strict: true,
      deprecationErrors: true,
    },
  });

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const collection = db.collection(COLLECTION_NAME);

    console.log('Connected to MongoDB');
    console.log(`Database: ${MONGODB_DB}`);
    console.log(`Collection: ${COLLECTION_NAME}`);
    console.log('---');

    const count = await collection.countDocuments();
    console.log(`Total documents in revenue_distributions: ${count}`);

    if (count === 0) {
      console.log('No revenue distribution records found!');
      console.log('This explains why the frontend shows ₹0');
      return;
    }

    const records = await collection.find().sort({ createdAt: -1 }).limit(10).toArray();
    console.log('\nLast 10 revenue distribution records:');
    records.forEach((record, index) => {
      console.log(`${index + 1}. Booking ID: ${record.booking_id}`);
      console.log(`   Warehouse: ${record.warehouse_id} (${record.warehouse_name})`);
      console.log(`   Total Amount: ₹${record.total_amount}`);
      console.log(`   Owner Share (60%): ₹${record.owner_share}`);
      console.log(`   Platform Share (40%): ₹${record.platform_share}`);
      console.log(`   Created: ${record.createdAt}`);
      console.log('---');
    });

    // Calculate summary
    const pipeline = [
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total_amount' },
          totalOwnerShare: { $sum: '$owner_share' },
          totalPlatformShare: { $sum: '$platform_share' },
        },
      },
    ];

    const [summary] = await collection.aggregate(pipeline).toArray();
    console.log('\nSummary:');
    console.log(`Total Revenue: ₹${summary?.totalRevenue ?? 0}`);
    console.log(`Total Owner Share: ₹${summary?.totalOwnerShare ?? 0}`);
    console.log(`Total Platform Share: ₹${summary?.totalPlatformShare ?? 0}`);

  } catch (error) {
    console.error('Error verifying revenue data:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

verifyRevenueData();