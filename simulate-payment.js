const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'wms_production';

async function simulatePayment() {
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

    const invoiceId = '69d5f4618a5d15e9ebc3f14d';

    // Get the invoice
    const invoice = await db.collection('invoices').findOne({
      _id: new ObjectId(invoiceId)
    });

    if (!invoice) {
      console.log('❌ Invoice not found');
      return;
    }

    console.log('Current invoice status:');
    console.log(`   Total Amount: ₹${invoice.totalAmount}`);
    console.log(`   Paid Amount: ₹${invoice.paidAmount || 0}`);
    console.log(`   Status: ${invoice.status}`);

    // Update invoice to PAID
    const totalAmount = invoice.totalAmount;
    await db.collection('invoices').updateOne(
      { _id: new ObjectId(invoiceId) },
      {
        $set: {
          paidAmount: totalAmount,
          pendingAmount: 0,
          status: 'PAID'
        }
      }
    );

    console.log('✅ Invoice updated to PAID');

    // Get the booking to extract warehouse info
    const booking = await db.collection('bookings').findOne({
      _id: invoice.bookingId
    });

    if (!booking) {
      console.log('❌ Booking not found for revenue notification');
      return;
    }

    // Map warehouse name to warehouse ID
    const warehouseNameToId = {
      'Warehouse 1': 'WH1',
      'Warehouse 2': 'WH2',
      'Warehouse 3': 'WH3',
      'Warehouse 4': 'WH4',
      'Warehouse 5': 'WH5',
    };

    const warehouseId = warehouseNameToId[booking.warehouseName] || 'WH1';

    console.log(`📤 Notifying revenue distribution system...`);
    console.log(`   Booking ID: ${booking._id.toString()}`);
    console.log(`   Warehouse: ${booking.warehouseName} (${warehouseId})`);
    console.log(`   Amount: ₹${totalAmount}`);

    // Call revenue distribution API
    const response = await fetch('http://localhost:4000/api/payment-success', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        booking_id: booking._id.toString(),
        warehouse_id: warehouseId,
        total_amount: totalAmount,
      }),
    });

    if (!response.ok) {
      console.error('❌ Failed to notify revenue distribution system:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Revenue distribution notification successful!');
    console.log('Response:', result);

  } catch (error) {
    console.error('Error simulating payment:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

simulatePayment();