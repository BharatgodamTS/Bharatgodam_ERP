const { MongoClient, ObjectId } = require('mongodb');
const { differenceInDays, endOfMonth } = require('date-fns');

async function testMonthSplitting() {
  console.log('=== TESTING MONTH-SPLITTING LOGIC ===\n');

  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('wms_production');

  // Get transactions for Sureshwar Corporation
  const transactions = await db.collection('transactions').find(
    { clientId: '69e1b5232a0f589ce50e12f4' },
    { sort: { date: 1 } }
  ).toArray();

  // Get commodities
  const commodityIds = [...new Set(transactions.map(t => t.commodityId))];
  const commodities = await db.collection('commodities').find(
    { _id: { $in: commodityIds.map(id => new ObjectId(id)) } }
  ).toArray();
  const commodityMap = new Map(commodities.map(c => [c._id.toString(), c]));

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
      qty: txn.quantityMT || 0
    });
  });

  // Generate periods
  const periods = [];
  txnGroups.forEach((txns, key) => {
    txns.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let balance = 0;
    const periodList = [];

    for (let i = 0; i < txns.length; i++) {
      const current = txns[i];
      const next = txns[i + 1];

      balance += current.type === 'INWARD' ? current.qty : -current.qty;

      if (!next) break;

      const fromDate = current.date;
      const toDate = next.date;
      const days = differenceInDays(new Date(toDate), new Date(fromDate)) + 1;

      if (days > 0) {
        periodList.push({
          fromDate,
          toDate,
          qty: balance,
          days,
          status: 'COMPLETED'
        });
      }
    }

    // Add last period
    if (txns.length > 0 && balance > 0) {
      const lastTxn = txns[txns.length - 1];
      const fromDate = lastTxn.date;
      const toDate = new Date().toISOString().split('T')[0];
      const days = differenceInDays(new Date(toDate), new Date(fromDate)) + 1;

      if (days > 0) {
        periodList.push({
          fromDate,
          toDate,
          qty: balance,
          days,
          status: 'ACTIVE'
        });
      }
    }

    periodList.forEach(p => periods.push(p));
  });

  console.log(`Generated ${periods.length} unsplit periods:\n`);
  periods.forEach((p, i) => {
    console.log(`${i+1}. ${p.fromDate} → ${p.toDate}: ${p.qty.toFixed(2)}MT, ${p.days} days (${p.status})`);
  });

  // Split by month boundaries
  function splitByMonth(period) {
    const result = [];
    let current = new Date(period.fromDate);
    const end = new Date(period.toDate);

    while (current <= end) {
      const monthEnd = endOfMonth(current);
      const segmentEnd = end < monthEnd ? end : monthEnd;

      const days = differenceInDays(segmentEnd, current) + 1;

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

  console.log(`\n✅ After month splitting: ${splitPeriods.length} periods\n`);
  splitPeriods.forEach((p, i) => {
    console.log(`${i+1}. ${p.fromDate} → ${p.toDate}: ${p.qty.toFixed(2)}MT, ${p.days} days (${p.status})`);
  });

  // Group by month and calculate totals
  const grouped = {};
  splitPeriods.forEach(p => {
    const monthKey = p.fromDate.substring(0, 7); // YYYY-MM
    if (!grouped[monthKey]) grouped[monthKey] = [];
    grouped[monthKey].push(p);
  });

  const rate = 10; // per MT per day
  console.log(`\n🔍 MONTHLY BREAKDOWN:\n`);
  const monthTotals = {};
  Object.keys(grouped).sort().forEach(month => {
    const monthPeriods = grouped[month];
    const monthTotal = monthPeriods.reduce((sum, p) => sum + (p.qty * rate * p.days), 0);
    monthTotals[month] = monthTotal;

    const monthName = new Date(month + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    console.log(`\n📅 ${monthName}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    monthPeriods.forEach(p => {
      const rent = p.qty * rate * p.days;
      console.log(`  ${p.fromDate} to ${p.toDate}: ${p.qty.toFixed(2)}MT × ₹${rate}/day × ${p.days}d = ₹${rent.toFixed(2)}`);
    });
    console.log(`  Month Total: ₹${monthTotal.toFixed(2)}`);
  });

  // Grand total
  const grandTotal = splitPeriods.reduce((sum, p) => sum + (p.qty * rate * p.days), 0);
  
  console.log(`\n${'━'.repeat(42)}`);
  console.log(`Grand Total: ₹${grandTotal.toFixed(2)}`);
  console.log(`${'━'.repeat(42)}\n`);

  // Summary table
  console.log('📊 Summary Table:');
  console.log('┌─────────────┬──────────────┐');
  console.log('│ Month       │ Total Rent   │');
  console.log('├─────────────┼──────────────┤');
  Object.keys(grouped).sort().forEach(month => {
    const monthName = new Date(month + '-01').toLocaleString('en-IN', { month: 'short', year: '2-digit' });
    console.log(`│ ${monthName.padEnd(11)} │ ₹${monthTotals[month].toFixed(2).padStart(10)} │`);
  });
  console.log('├─────────────┼──────────────┤');
  console.log(`│ GRAND TOTAL │ ₹${grandTotal.toFixed(2).padStart(10)} │`);
  console.log('└─────────────┴──────────────┘');

  await client.close();
}

testMonthSplitting().catch(err => console.error(err));
