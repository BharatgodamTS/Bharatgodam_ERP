const { getRevenueAnalyticsFromInvoices } = require('./app/actions/transaction-actions');

async function testRevenueTotals() {
  console.log('Testing revenue analytics...');

  try {
    const result = await getRevenueAnalyticsFromInvoices();

    console.log('Summary:', result.summary);
    console.log('Number of monthly entries:', result.monthlyWarehouseRevenue.length);

    // Calculate sum of all monthly rents
    const sumOfMonthlyRents = result.monthlyWarehouseRevenue.reduce((sum, item) => sum + item.totalRevenue, 0);

    console.log('Sum of monthly rents from table:', Math.round(sumOfMonthlyRents * 100) / 100);
    console.log('Total revenue from summary:', result.summary.totalRevenue);

    const difference = Math.abs(sumOfMonthlyRents - result.summary.totalRevenue);
    console.log('Difference:', Math.round(difference * 100) / 100);

    if (difference < 0.01) {
      console.log('✅ SUCCESS: Total revenue matches sum of monthly rents!');
    } else {
      console.log('❌ FAILED: Total revenue does not match sum of monthly rents!');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testRevenueTotals();