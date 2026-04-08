// const fetch = require('node-fetch'); // Node 18+ has built-in fetch

const REVENUE_API_BASE = process.env.REVENUE_API_BASE || 'http://localhost:4000';

async function testPaymentSuccess() {
  console.log('Testing payment success notification...');

  try {
    const response = await fetch(`${REVENUE_API_BASE}/api/payment-success`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        booking_id: '507f1f77bcf86cd799439011', // Sample ObjectId
        warehouse_id: 'WH1',
        total_amount: 10000, // ₹10,000
      }),
    });

    if (!response.ok) {
      console.error('Failed to call payment success API:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }

    const result = await response.json();
    console.log('Payment success API response:', result);

    if (result.success) {
      console.log('✅ Payment notification successful!');
      console.log('Revenue distribution should now show data.');
    } else {
      console.error('❌ Payment notification failed:', result.error);
    }
  } catch (error) {
    console.error('Error calling payment success API:', error);
  }
}

// Test the revenue distribution GET endpoint
async function testRevenueDistribution() {
  console.log('\nTesting revenue distribution GET...');

  try {
    const response = await fetch(`${REVENUE_API_BASE}/api/revenue-distribution`);

    if (!response.ok) {
      console.error('Failed to fetch revenue distribution:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    console.log('Revenue distribution data:');
    console.log('Success:', data.success);
    console.log('Summary:', data.summary);
    console.log('Records count:', data.records?.length || 0);

    if (data.records && data.records.length > 0) {
      console.log('First record:', data.records[0]);
    }
  } catch (error) {
    console.error('Error fetching revenue distribution:', error);
  }
}

async function runTests() {
  await testPaymentSuccess();
  await testRevenueDistribution();
}

runTests();