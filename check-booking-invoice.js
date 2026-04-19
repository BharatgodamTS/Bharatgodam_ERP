const { MongoClient } = require('mongodb');

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'wms_production';

async function checkBookingAndInvoice() {
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

    console.log('Connected to MongoDB');
    console.log(`Database: ${MONGODB_DB}`);
    console.log('---');

    // Check the specific booking
    const booking = await db.collection('bookings').findOne({
      _id: require('mongodb').ObjectId.createFromHexString('69d5f4618a5d15e9ebc3f14c')
    });

    if (booking) {
      console.log('✅ Booking found:');
      console.log(`   ID: ${booking._id}`);
      console.log(`   S.No: ${booking.sNo}`);
      console.log(`   Warehouse: ${booking.warehouseName}`);
      console.log(`   Client: ${booking.clientName}`);
      console.log(`   Commodity: ${booking.commodityName}`);
      console.log(`   MT: ${booking.mt}`);
      console.log(`   Status: ${booking.status}`);
      console.log(`   Created: ${booking.createdAt}`);
    } else {
      console.log('❌ Booking not found');
    }

    console.log('---');

    // Check the specific invoice
    const invoice = await db.collection('invoices').findOne({
      _id: require('mongodb').ObjectId.createFromHexString('69d5f4618a5d15e9ebc3f14d')
    });

    if (invoice) {
      console.log('✅ Invoice found:');
      console.log(`   ID: ${invoice._id}`);
      console.log(`   Booking ID: ${invoice.bookingId}`);
      console.log(`   Client: ${invoice.customerName}`);
      console.log(`   Total Amount: ₹${invoice.totalAmount}`);
      console.log(`   Paid Amount: ₹${invoice.paidAmount || 0}`);
      console.log(`   Pending Amount: ₹${invoice.pendingAmount || invoice.totalAmount}`);
      console.log(`   Status: ${invoice.status}`);
      console.log(`   Generated: ${invoice.generatedAt}`);
    } else {
      console.log('❌ Invoice not found');
    }

    console.log('---');

    // Check all unpaid invoices
    const unpaidInvoices = await db.collection('invoices')
      .find({ status: 'UNPAID' })
      .sort({ generatedAt: -1 })
      .limit(5)
      .toArray();

    console.log(`Found ${unpaidInvoices.length} unpaid invoices:`);
    unpaidInvoices.forEach((inv, index) => {
      console.log(`${index + 1}. ${inv.customerName} - ₹${inv.totalAmount} (${inv.commodity})`);
    });

  } catch (error) {
    console.error('Error checking booking and invoice:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

checkBookingAndInvoice();