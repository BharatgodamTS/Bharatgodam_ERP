/**
 * Database Cleaning Script
 * Clears all data from the warehouse management database
 * Uses the same database connection as the application
 */

const { MongoClient } = require('mongodb');

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'wms_production';

async function cleanDatabase() {
  const client = new MongoClient(MONGODB_URL, {
    serverApi: {
      version: '1',
      strict: true,
      deprecationErrors: true,
    },
  });

  try {
    console.log('🧹 Starting database cleanup...');
    console.log(`📍 MongoDB URL: ${MONGODB_URL}`);
    console.log(`📊 Database: ${MONGODB_DB}`);

    await client.connect();
    const db = client.db(MONGODB_DB);

    // List of all collections to clean
    const collections = [
      'bookings',
      'transactions',
      'payments',
      'clients',
      'client_accounts',
      'inwards',
      'outwards',
      'commodities',
      'warehouses',
      'invoices',
      'ledger_entries',
      'users',
      'sessions',
      'accounts',
      'revenue_distributions'
    ];

    console.log('📋 Collections to clean:', collections.join(', '));
    console.log('---');

    let totalDocumentsDeleted = 0;

    // Clear each collection
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        if (count > 0) {
          await collection.deleteMany({});
          console.log(`✅ Cleared ${collectionName}: ${count} documents deleted`);
          totalDocumentsDeleted += count;
        }
      } catch (error) {
        console.log(`⚠️  Collection ${collectionName} not found or error: ${error.message}`);
      }
    }

    console.log('---');
    console.log(`🎉 Database cleanup completed successfully!`);
    console.log(`📊 Total documents deleted: ${totalDocumentsDeleted}`);
    console.log('💡 Note: Indexes and collection structure preserved');

  } catch (error) {
    console.error('❌ Database cleanup failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the cleanup
cleanDatabase();