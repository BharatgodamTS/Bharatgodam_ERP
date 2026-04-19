// Test script to validate month-end +1 day logic
const { isLastDayOfMonth } = require('date-fns');

function calculateStorageDays(fromDate, toDate) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  
  // Simple days difference
  const daysMs = to.getTime() - from.getTime();
  let days = Math.floor(daysMs / (1000 * 60 * 60 * 24));
  
  console.log(`  From: ${fromDate}, To: ${toDate}`);
  console.log(`  Base days: ${days}`);
  console.log(`  Is end of month: ${isLastDayOfMonth(to)}`);
  
  // If period ends on the last day of the month, add +1
  if (isLastDayOfMonth(to)) {
    days += 1;
    console.log(`  ✅ Added +1 for month-end`);
  } else {
    console.log(`  ❌ No +1 (not month-end)`);
  }
  
  console.log(`  Final days: ${days}\n`);
  return days;
}

console.log('=== Test Case 1: Ends on month end (2026-03-31) ===');
const days1 = calculateStorageDays('2026-03-21', '2026-03-31');
console.assert(days1 === 11, `Expected 11 days, got ${days1}`);

console.log('=== Test Case 2: Not month end (2026-03-28) ===');
const days2 = calculateStorageDays('2026-03-21', '2026-03-28');
console.assert(days2 === 7, `Expected 7 days, got ${days2}`);

console.log('=== Test Case 3: Ends on month end (2026-02-29) ===');
const days3 = calculateStorageDays('2026-02-01', '2026-02-28');
console.assert(days3 === 28, `Expected 28 days, got ${days3}`);

console.log('=== Test Case 4: Single day on month end (2026-03-31) ===');
const days4 = calculateStorageDays('2026-03-31', '2026-03-31');
console.assert(days4 === 1, `Expected 1 day, got ${days4}`);

console.log('✅ All tests passed!');
