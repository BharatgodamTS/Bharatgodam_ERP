/**
 * Data Consistency Verification Script
 * Checks if data entered in one collection appears correctly in related collections
 */

const { MongoClient } = require('mongodb');
const readline = require('readline');

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'wms_production';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function verifyDataConsistency() {
  const client = new MongoClient(MONGODB_URL, {
    serverApi: {
      version: '1',
      strict: true,
      deprecationErrors: true,
    },
  });

  try {
    console.log('\n🔎 DATA CONSISTENCY VERIFICATION TOOL\n');
    console.log('═══════════════════════════════════════════════');
    console.log(`📍 Database: ${MONGODB_DB}`);
    console.log('═══════════════════════════════════════════════\n');

    await client.connect();
    const db = client.db(MONGODB_DB);

    console.log('📋 Available Collections:');
    console.log('───────────────────────────────────────────────');

    // List available collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    collectionNames.forEach((name, i) => {
      console.log(`   ${i + 1}. ${name}`);
    });

    console.log('───────────────────────────────────────────────\n');

    // Get collection choice
    const collectionChoice = await question(
      `Enter collection name to check (or 'exit'): `
    );

    if (collectionChoice.toLowerCase() === 'exit') {
      rl.close();
      await client.close();
      process.exit(0);
    }

    const collection = db.collection(collectionChoice);
    const count = await collection.countDocuments();

    if (count === 0) {
      console.log(`\n⚠️  No documents found in '${collectionChoice}' collection\n`);
      rl.close();
      await client.close();
      process.exit(0);
    }

    // Get field to search by
    console.log(`\n✅ Found ${count} documents in '${collectionChoice}'\n`);
    const searchField = await question(
      `Enter field to search by (e.g., clientName, warehouseName): `
    );
    const searchValue = await question(`Enter value to search for: `);

    console.log('\n🔍 SEARCHING...\n');
    console.log('───────────────────────────────────────────────');

    // Search in the collection
    const query = {};
    query[searchField] = { $regex: searchValue, $options: 'i' };
    const results = await collection.find(query).toArray();

    if (results.length === 0) {
      console.log(`❌ No documents found with ${searchField}="${searchValue}"\n`);
    } else {
      console.log(`✅ Found ${results.length} matching document(s):\n`);

      results.forEach((doc, index) => {
        console.log(`📄 Document ${index + 1}:`);
        console.log(JSON.stringify(doc, null, 2));
        console.log('');
      });

      // Check if data exists in related collections
      console.log('───────────────────────────────────────────────');
      console.log('\n🔗 CHECKING RELATED COLLECTIONS:\n');

      const clientName = results[0].clientName || results[0].name;
      
      if (clientName) {
        // Check in other collections
        const checkCollections = ['invoices', 'ledger_entries', 'transactions', 'payments'];
        
        for (const checkCol of checkCollections) {
          try {
            const col = db.collection(checkCol);
            const relatedCount = await col.countDocuments({
              $or: [
                { clientName: { $regex: clientName, $options: 'i' } },
                { 'client_name': { $regex: clientName, $options: 'i' } }
              ]
            });

            if (relatedCount > 0) {
              console.log(`   ✅ ${checkCol}: ${relatedCount} related document(s)`);
            } else {
              console.log(`   ⚠️  ${checkCol}: No related documents found`);
            }
          } catch (e) {
            console.log(`   ⚠️  ${checkCol}: Unable to check`);
          }
        }
      }
    }

    console.log('\n───────────────────────────────────────────────\n');

  } catch (error) {
    console.error('❌ VERIFICATION FAILED:', error.message);
  } finally {
    rl.close();
    await client.close();
    process.exit(0);
  }
}

// Run the verification
verifyDataConsistency();