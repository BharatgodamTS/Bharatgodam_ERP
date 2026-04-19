const { MongoClient, ObjectId } = require('mongodb');

async function testLedgerLogic() {
  console.log('=== TESTING LEDGER LOGIC FOR SURESHWAR ===');

  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('wms_production');

  // Get transactions
  const transactions = await db.collection('transactions').find(
    { clientId: '69e1b5232a0f589ce50e12f4' },
    { sort: { date: 1 } }
  ).toArray();

  console.log(`Found ${transactions.length} transactions`);

  // Get commodities
  const commodityIds = [...new Set(transactions.map(t => t.commodityId))];
  const commodities = await db.collection('commodities').find(
    { _id: { $in: commodityIds.map(id => new ObjectId(id)) } }
  ).toArray();
  const commodityMap = new Map(commodities.map(c => [c._id.toString(), c]));

  console.log(`Found ${commodities.length} commodities`);

  // Convert to Transaction format
  const txnGroups = new Map();

  transactions.forEach(txn => {
    const key = `${txn.commodityId}-${txn.warehouseId}`;
    if (!txnGroups.has(key)) txnGroups.set(key, []);

    const commodity = commodityMap.get(txn.commodityId);
    const rate = commodity?.ratePerMtPerDay || 10;

    const dateStr = txn.date instanceof Date ? txn.date.toISOString().split('T')[0] :
                    typeof txn.date === 'string' && txn.date.includes('T') ? txn.date.split('T')[0] :
                    txn.date;

    txnGroups.get(key).push({
      date: dateStr,
      type: txn.direction === 'INWARD' ? 'INWARD' : 'OUTWARD',
      qty: txn.quantityMT || 0,
      clientId: txn.clientId,
      commodityId: txn.commodityId,
      warehouseId: txn.warehouseId
    });
  });

  console.log(`Created ${txnGroups.size} transaction groups`);

  // Simulate generateStoragePeriods for first group
  const firstGroupKey = Array.from(txnGroups.keys())[0];
  const txns = txnGroups.get(firstGroupKey);

  console.log(`Testing group ${firstGroupKey} with ${txns.length} transactions:`);
  txns.forEach((t, i) => console.log(`${i+1}. ${t.date} ${t.type} ${t.qty}MT`));

  // Manually implement the fixed generateStoragePeriods logic
  console.log('\n=== TESTING FIXED generateStoragePeriods LOGIC ===');

  // Step 1: Normalize transactions
  const normalizedTxns = txns.map(t => ({
    date: t.date,
    qty: t.type === 'INWARD' ? t.qty : -t.qty
  }));
  console.log('Normalized transactions:', normalizedTxns);

  // Step 2: Group by date to get daily net changes (CRITICAL FIX)
  const groupedByDate = {};
  normalizedTxns.forEach(txn => {
    if (!groupedByDate[txn.date]) groupedByDate[txn.date] = 0;
    groupedByDate[txn.date] += txn.qty;
  });
  console.log('Grouped by date (daily net changes):', groupedByDate);

  // Step 3: Convert to sorted daily transactions
  const dailyTxns = Object.entries(groupedByDate)
    .map(([date, qty]) => ({ date, qty }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  console.log('Daily transactions (sorted):', dailyTxns);

  // Step 4: Generate periods using running balance
  let balance = 0;
  const periods = [];

  for (let i = 0; i < dailyTxns.length; i++) {
    const current = dailyTxns[i];
    const next = dailyTxns[i + 1];

    balance += current.qty;

    if (!next) break;

    // Calculate days between dates (boundary-based, no +1)
    const days = Math.floor((new Date(next.date).getTime() - new Date(current.date).getTime()) / (1000 * 60 * 60 * 24));

    if (days > 0) {
      const rent = balance * 10 * days;
      periods.push({
        fromDate: current.date,
        toDate: next.date,
        qty: balance,
        days,
        rate: 10,
        rent,
        status: 'COMPLETED'
      });
      console.log(`Added period: ${current.date} to ${next.date}, balance: ${balance}, days: ${days}`);
    }
  }

  // Step 5: Handle last period
  if (dailyTxns.length > 0) {
    const lastTxn = dailyTxns[dailyTxns.length - 1];
    const fromDate = lastTxn.date;
    const toDate = new Date().toISOString().split('T')[0];
    const days = Math.floor((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24));

    console.log(`Last period: ${fromDate} to ${toDate}, balance: ${balance}, days: ${days}`);

    if (days > 0 && balance > 0) {
      const rent = balance * 10 * days;
      periods.push({
        fromDate,
        toDate,
        qty: balance,
        days,
        rate: 10,
        rent,
        status: balance > 0 ? 'ACTIVE' : 'COMPLETED'
      });
      console.log(`Added last period: ${fromDate} to ${toDate}, ${balance}MT, ${days} days`);
    }
  }

  console.log(`\nGenerated ${periods.length} periods:`);
  periods.forEach((p, i) => console.log(`${i+1}. ${p.fromDate} to ${p.toDate}: ${p.qty}MT for ${p.days} days (${p.status})`));

  // Split periods by month
  function splitByMonth(period) {
    const result = [];
    let current = new Date(period.fromDate);
    const end = new Date(period.toDate);

    while (current <= end) {
      // Get last day of current month
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      const segmentEnd = end < monthEnd ? end : monthEnd;

      const days = Math.floor((segmentEnd - current) / (1000 * 60 * 60 * 24)) + 1;

      result.push({
        fromDate: current.toISOString().split('T')[0],
        toDate: segmentEnd.toISOString().split('T')[0],
        qty: period.qty,
        days,
        status: period.status
      });

      current = new Date(segmentEnd);
      current.setDate(current.getDate() + 1);
    }

    return result;
  }

  // Apply month splitting
  const splitPeriods = periods.flatMap(p => splitByMonth(p));

  console.log(`\n=== AFTER MONTH SPLITTING ===`);
  console.log(`Split into ${splitPeriods.length} periods:`);
  splitPeriods.forEach((p, i) => console.log(`${i+1}. ${p.fromDate} to ${p.toDate}: ${p.qty}MT for ${p.days} days (${p.status})`));

  // Group by month and calculate totals
  const grouped = {};
  splitPeriods.forEach(p => {
    const monthKey = p.fromDate.substring(0, 7); // YYYY-MM
    if (!grouped[monthKey]) grouped[monthKey] = [];
    grouped[monthKey].push(p);
  });

  console.log(`\n=== MONTHLY BREAKDOWN ===`);
  const rate = 10; // per MT per day
  Object.keys(grouped).sort().forEach(month => {
    const periods = grouped[month];
    const total = periods.reduce((sum, p) => sum + (p.qty * rate * p.days), 0);
    console.log(`\n${month}:`);
    periods.forEach(p => {
      const rent = p.qty * rate * p.days;
      console.log(`  ${p.fromDate} to ${p.toDate}: ${p.qty.toFixed(2)}MT × ₹${rate}/day × ${p.days} days = ₹${rent.toFixed(2)}`);
    });
    console.log(`  Month Total: ₹${total.toFixed(2)}`);
  });

  // Grand total
  const grandTotal = splitPeriods.reduce((sum, p) => sum + (p.qty * rate * p.days), 0);
  console.log(`\nGrand Total: ₹${grandTotal.toFixed(2)}`);

  await client.close();
}

testLedgerLogic();