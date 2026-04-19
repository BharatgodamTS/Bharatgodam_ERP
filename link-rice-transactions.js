const { MongoClient, ObjectId } = require('mongodb');
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'wms_production';

async function linkRiceTransactions() {
  const client = new MongoClient(MONGODB_URL);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB);

    // Get the first client account
    const clientAccount = await db.collection('client_accounts').findOne({});
    if (!clientAccount) {
      console.log('No client account found!');
      return;
    }

    console.log('Linking RICE transactions to client account: ' + clientAccount.clientName);

    // Update RICE transactions to link to this client account
    const result = await db.collection('transactions').updateMany(
      { commodityName: 'RICE', accountId: { $exists: false } },
      { $set: { accountId: clientAccount._id.toString() } }
    );

    console.log('Updated ' + result.modifiedCount + ' RICE transactions');

    // Verify the updates
    const updatedTransactions = await db.collection('transactions').find({
      commodityName: 'RICE'
    }).toArray();

    console.log('Updated RICE transactions:');
    updatedTransactions.forEach(function(txn) {
      console.log('  ' + txn._id.toString() + ': accountId = ' + txn.accountId);
    });

  } finally {
    await client.close();
  }
}
linkRiceTransactions();