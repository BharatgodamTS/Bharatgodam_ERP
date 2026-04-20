const { MongoClient } = require('mongodb');
(async () => {
  const uri = 'mongodb://localhost:27017';
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db('wms_production');

    // Simulate the getRevenueAnalyticsFromInvoices logic
    const allLedgerEntries = await db.collection('ledger_entries').find({}).toArray();
    console.log('Total ledger entries:', allLedgerEntries.length);

    const outwards = await db.collection('outwards').find({}).toArray();
    console.log('Total outward entries:', outwards.length);

    // Get warehouse names
    const warehouseIds = [...new Set(allLedgerEntries.map(entry => entry.warehouseId.toString()))];
    const warehouses = await db.collection('warehouses').find({
      _id: { $in: warehouseIds }
    }).toArray();
    const warehouseMap = new Map(warehouses.map(w => [w._id.toString(), w.name]));

    // Filter entries (no warehouse filter)
    const filteredEntries = allLedgerEntries;

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

    // Process entries
    const monthlyData = new Map();
    let totalRevenue = 0;

    filteredEntries.forEach((entry) => {
      const startDate = new Date(entry.periodStartDate);
      let endDate = entry.periodEndDate ? new Date(entry.periodEndDate) : new Date();

      // Adjust end date based on outward entries
      const key = `${entry.clientId}-${entry.warehouseId}-${entry.commodityId}`;
      if (outwardDates.has(key)) {
        const outwardDate = outwardDates.get(key);
        if (outwardDate > startDate && outwardDate < endDate) {
          endDate = outwardDate;
        }
      }

      const quantity = entry.quantityMT || 0;
      const rate = entry.ratePerMTPerDay || 0;

      // Month splitting logic
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth();

      for (let year = startYear; year <= endYear; year++) {
        const monthStart = year === startYear ? startMonth : 0;
        const monthEnd = year === endYear ? endMonth : 11;

        for (let month = monthStart; month <= monthEnd; month++) {
          const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
          const monthFirstDay = new Date(year, month, 1);
const monthLastDay = new Date(year, month + 1, 0);

          let periodStart = monthFirstDay;
          let periodEnd = monthLastDay;

          // Adjust for start date
          if (year === startYear && month === startMonth) {
            periodStart = startDate;
          }

          // Adjust for end date
          if (year === endYear && month === endMonth) {
            periodEnd = endDate;
          }

          // Ensure periodStart is not before the overall start date (only for start month)
          if (year === startYear && month === startMonth && periodStart < startDate) {
            periodStart = startDate;
          }

          // Ensure periodEnd is not after the overall end date (only for end month)
          if (year === endYear && month === endMonth && periodEnd > endDate) {
            periodEnd = endDate;
          }

          if (periodStart <= periodEnd) {
            const daysInMonth = Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const revenueInMonth = quantity * rate * daysInMonth;

            console.log(`Entry ${entry._id}: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}, month=${monthKey}, periodStart=${periodStart.toISOString().split('T')[0]}, periodEnd=${periodEnd.toISOString().split('T')[0]}, days=${daysInMonth}, revenue=₹${revenueInMonth.toFixed(2)}`);

            const warehouseIdStr = entry.warehouseId.toString();
            const mapKey = `${warehouseIdStr}-${monthKey}`;

            if (!monthlyData.has(mapKey)) {
              monthlyData.set(mapKey, {
                warehouseId: entry.warehouseId,
                warehouseName: warehouseMap.get(warehouseIdStr) || 'Unknown',
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
            data.totalRevenue += revenueInMonth;
            data.totalDays += daysInMonth;
            data.ledgerCount += 1;
            data.totalQuantityDays += quantity * daysInMonth;
            data.avgQuantityMT = data.totalQuantityDays / data.ledgerCount;
            data.endingInventory = quantity;

            totalRevenue += revenueInMonth;
          }
        }
      }
    });

    const monthlyWarehouseRevenue = Array.from(monthlyData.values())
      .map(item => ({
        warehouseId: item.warehouseId.toString(),
        warehouseName: item.warehouseName,
        month: item.month,
        days: item.totalDays,
        quantityDays: Math.round(item.totalQuantityDays * 100) / 100,
        avgQuantityMT: Math.round(item.avgQuantityMT * 100) / 100,
        rent: Math.round(item.totalRevenue * 100) / 100,
        endingInventory: Math.round(item.endingInventory * 100) / 100
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    console.log('\nMonthly Warehouse Revenue:');
    monthlyWarehouseRevenue.forEach(item => {
      console.log(`${item.warehouseName} - ${item.month}: ${item.days} days, ${item.quantityDays} qty-days, avg ${item.avgQuantityMT} MT, ₹${item.rent}, ending ${item.endingInventory} MT`);
    });

    console.log(`\nTotal Revenue: ₹${Math.round(totalRevenue * 100) / 100}`);

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await client.close();
  }
})();