const { MongoClient } = require('mongodb');
(async () => {
  const uri = 'mongodb://localhost:27017';
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db('wms_production');

    const ledgerEntries = await db.collection('ledger_entries').find({}).toArray();
    const outwards = await db.collection('outwards').find({}).toArray();

    // Create map of earliest outward dates by client/warehouse/commodity
    const outwardDates = new Map();
    outwards.forEach(outward => {
      const key = `${outward.clientId}-${outward.warehouseId}-${outward.commodityId}`;
      const outwardDate = new Date(outward.date);
      outwardDate.setHours(23, 59, 59, 999); // End of day

      if (!outwardDates.has(key) || outwardDate < outwardDates.get(key)) {
        outwardDates.set(key, outwardDate);
      }
    });

    // Group by warehouse and month
    const monthlyData = new Map();

    ledgerEntries.forEach((entry) => {
      const startDate = new Date(entry.periodStartDate);
      let endDate = entry.periodEndDate ? new Date(entry.periodEndDate) : new Date();

      // Adjust end date based on outward entries
      const key = `${entry.clientId}-${entry.warehouseId}-${entry.commodityId}`;
      if (outwardDates.has(key)) {
        const outwardDate = outwardDates.get(key);
        if (outwardDate < endDate) {
          endDate = outwardDate;
        }
      }

      const days = Math.max(0, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      const quantity = entry.quantityMT || 0;
      const rate = entry.ratePerMTPerDay || 0;
      const revenue = quantity * rate * days;

      // Get month from start date
      const monthKey = startDate.toISOString().slice(0, 7); // YYYY-MM
      const warehouseIdStr = entry.warehouseId.toString();
      const mapKey = `${warehouseIdStr}-${monthKey}`;

      if (!monthlyData.has(mapKey)) {
        monthlyData.set(mapKey, {
          warehouseId: warehouseIdStr,
          month: monthKey,
          totalRevenue: 0,
          entries: []
        });
      }

      const data = monthlyData.get(mapKey);
      data.totalRevenue += revenue;
      data.entries.push({
        revenue: Math.round(revenue * 100) / 100,
        quantity,
        rate,
        days,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
    });

    console.log('MONTHLY BREAKDOWN:');
    let totalFromMonthly = 0;
    monthlyData.forEach((data, key) => {
      console.log(`${data.month} - Warehouse ${data.warehouseId}: ₹${Math.round(data.totalRevenue * 100) / 100}`);
      totalFromMonthly += data.totalRevenue;

      // Show first few entries for this month-warehouse
      console.log('  Entries:');
      data.entries.slice(0, 3).forEach((entry, idx) => {
        console.log(`    ${idx + 1}. ${entry.quantity} MT × ₹${entry.rate}/day × ${entry.days} days = ₹${entry.revenue} (${entry.startDate} to ${entry.endDate})`);
      });
      if (data.entries.length > 3) {
        console.log(`    ... and ${data.entries.length - 3} more entries`);
      }
      console.log('');
    });

    console.log(`Total from monthly aggregation: ₹${Math.round(totalFromMonthly * 100) / 100}`);

    // Compare with direct sum
    let directTotal = 0;
    ledgerEntries.forEach((entry) => {
      const startDate = new Date(entry.periodStartDate);
      let endDate = entry.periodEndDate ? new Date(entry.periodEndDate) : new Date();

      const key = `${entry.clientId}-${entry.warehouseId}-${entry.commodityId}`;
      if (outwardDates.has(key)) {
        const outwardDate = outwardDates.get(key);
        if (outwardDate < endDate) {
          endDate = outwardDate;
        }
      }

      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const quantity = entry.quantityMT || 0;
      const rate = entry.ratePerMTPerDay || 0;
      directTotal += quantity * rate * days;
    });

    console.log(`Direct sum of all entries: ₹${Math.round(directTotal * 100) / 100}`);
    console.log(`Match: ${Math.round(totalFromMonthly * 100) / 100 === Math.round(directTotal * 100) / 100}`);

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await client.close();
  }
})();