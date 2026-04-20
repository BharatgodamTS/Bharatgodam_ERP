const { MongoClient } = require('mongodb');
(async () => {
  const uri = 'mongodb://localhost:27017';
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db('wms_production');

    const ledgerEntries = await db.collection('ledger_entries').find({}).toArray();
    const outwards = await db.collection('outwards').find({}).toArray();

    // Create outward date map
    const outwardDates = new Map();
    outwards.forEach(outward => {
      const key = `${outward.clientId}-${outward.warehouseId}-${outward.commodityId}`;
      const outwardDate = new Date(outward.date);
      outwardDate.setHours(23, 59, 59, 999);

      if (!outwardDates.has(key) || outwardDate < outwardDates.get(key)) {
        outwardDates.set(key, outwardDate);
      }
    });

    // Process entries with proper month splitting
    const monthlyData = new Map();
    let totalRevenue = 0;

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

      const quantity = entry.quantityMT || 0;
      const rate = entry.ratePerMTPerDay || 0;
      const warehouseIdStr = entry.warehouseId.toString();

      // Split the period by months
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const monthKey = currentDate.toISOString().slice(0, 7);
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const periodStart = currentDate < monthStart ? monthStart : currentDate;
        const periodEnd = endDate < monthEnd ? endDate : monthEnd;

        const daysInMonth = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        if (daysInMonth > 0) {
          const revenue = quantity * rate * daysInMonth;
          const mapKey = `${warehouseIdStr}-${monthKey}`;

          if (!monthlyData.has(mapKey)) {
            monthlyData.set(mapKey, {
              warehouseId: warehouseIdStr,
              month: monthKey,
              totalRevenue: 0,
              totalDays: 0,
              ledgerCount: 0,
              totalQuantityDays: 0,
              avgQuantityMT: 0,
              endingInventory: 0
            });
          }

          const data = monthlyData.get(mapKey);
          data.totalRevenue += revenue;
          data.totalDays += daysInMonth;
          data.ledgerCount += 1;
          data.totalQuantityDays += quantity * daysInMonth;

          totalRevenue += revenue;
        }

        // Move to next month
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      }
    });

    console.log('Monthly breakdown with proper splitting:');
    monthlyData.forEach((data, key) => {
      console.log(`${data.month}: ₹${Math.round(data.totalRevenue * 100) / 100} (${data.totalDays} days)`);
    });

    console.log(`\nTotal Revenue: ₹${Math.round(totalRevenue * 100) / 100}`);

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await client.close();
  }
})();