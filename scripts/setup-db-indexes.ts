import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Please set MONGODB_URI in your environment variables.");
  process.exit(1);
}

async function setupIndexes() {
  const client = new MongoClient(uri as string);

  try {
    await client.connect();
    
    // Choose correct DB name
    const dbName = process.env.MONGODB_DB || (uri?.includes('wms_production') ? 'wms_production' : 'test');
    const db = client.db(dbName);
    const bookings = db.collection('bookings');

    console.log(`Connected to database: ${dbName}. Setting up indexes...`);

    // Create a compound index for filtering
    // This allows fast matching for warehouseName AND commodityName sequentially
    await bookings.createIndex({ warehouseName: 1, commodityName: 1, date: -1 });

    // Global text index simulation (index on fields used in regex searches)
    await bookings.createIndex({ clientName: 1 });
    await bookings.createIndex({ truckNumber: 1 });
    
    // Default sorting index
    await bookings.createIndex({ date: -1, createdAt: -1 });

    console.log('✅ Indexes configured successfully.');

  } catch (error) {
    console.error('❌ Failed to set up indexes:', error);
  } finally {
    await client.close();
  }
}

setupIndexes();
