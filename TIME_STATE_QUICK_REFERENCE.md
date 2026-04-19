# TIME-STATE SYSTEM: Quick Reference

## What's New

The ledger now behaves as a **TIME-STATE SYSTEM** - continuously tracking stock presence with automatic period splitting instead of just measuring transaction-to-transaction intervals.

## At a Glance

| Aspect | Old System | New TIME-STATE |
|--------|-----------|-----------------|
| **View** | One interval per transaction pair | Monthly periods with automatic splits |
| **Splitting** | Manual, if at all | Automatic when stock changes |
| **History** | Updates overwrite past | Past data preserved (immutable) |
| **Status** | Just quantity | Active/Removed/Partial status |
| **Visualization** | Few linear steps | Full continuous timeline |

## Example Output

**Scenario**: 100 MT inward on Jan 1, partial removal (30 MT) on Mar 20

### TIME-STATE Output
```
Period              Quantity  Status           Days   Rent
─────────────────────────────────────────────────────────────
1 Jan – 31 Jan     100 MT    Active           31     ₹31,000
1 Feb – 28 Feb     100 MT    Active           28     ₹28,000
1 Mar – 20 Mar     100 MT    Active           20     ₹20,000
20 Mar onwards     70 MT     Active (split)   11     ₹7,700
```

## Files Overview

### 1. **Schema** (`src/types/schemas.ts`)
Added `ILedgerTimeState` interface:
- Period start/end dates
- Quantity tracking
- Status (ACTIVE/PARTIAL/REMOVED/CLOSED)
- Transaction reference
- Historical record flag

### 2. **Engine** (`src/lib/ledger-time-state-engine.ts`)
Core calculation:
- `generateTimeStateLedger()` - Creates all periods with auto-splitting
- `exportTimeStateLedgerAsCSV()` - Export to CSV
- `formatTimeStateForDisplay()` - Formats for UI

### 3. **API** (`src/app/api/ledger/time-state/route.ts`)
Two endpoints:
- **POST** - Generate and save periods from transactions
- **GET** - Retrieve stored time-state entries

### 4. **Action** (`src/app/actions/consolidated-ledger.ts`)
Updated to generate TIME-STATE in parallel with traditional ledger:
- `getConsolidatedLedger()` now returns both `ledgerSummary` (old) and `timeStateLedger` (new)

### 5. **Component** (`src/components/features/ledger/time-state-ledger-table.tsx`)
UI display with:
- Period table with color-coded status
- Summary statistics
- Transaction details
- Export options

## Integration Steps

### Step 1: Use in Dashboard
```typescript
import { TimeStateLedgerTable } from '@/components/features/ledger/time-state-ledger-table';

// In your dashboard page:
const { data } = await getConsolidatedLedger(bookingId);

return (
  <>
    <TimeStateLedgerTable timeStateLedger={data.timeStateLedger} />
  </>
);
```

### Step 2: Call API to Save Periods
```typescript
const response = await fetch('/api/ledger/time-state', {
  method: 'POST',
  body: JSON.stringify({
    accountId: bookingId,
    clientName: clientName,
    transactions: transactionsArray,
  }),
});

const result = await response.json();
console.log(`Created ${result.entriesCreated} periods`);
```

### Step 3: Retrieve Saved Periods
```typescript
const response = await fetch(`/api/ledger/time-state?accountId=${bookingId}`);
const { entries } = await response.json();
```

## Key Behavior

### Automatic Splitting Example
```
Transaction on Jan 15: INWARD 100 MT
Transaction on Mar 10: OUTWARD 30 MT

Generated Periods:
1. Jan 15 – Jan 31  → 100 MT (ACTIVE)
2. Feb 1 – Feb 28   → 100 MT (ACTIVE)
3. Mar 1 – Mar 9    → 100 MT (ACTIVE)
4. Mar 10 (txn day) → 100 → 70 MT (PARTIAL)
5. Mar 11 onwards   → 70 MT (ACTIVE)

Notice: Mar period SPLIT around transaction date
```

### Status Meanings
- **ACTIVE**: Stock is in warehouse, no changes
- **PARTIAL_REMOVAL**: Transaction occurred, quantity changed
- **REMOVED**: All stock removed, period ended
- **CLOSED**: Period complete, no more activity

### Historical Record Protection
```typescript
historicalRecord: true   // Past period (immutable)
historicalRecord: false  // Ongoing period (can update)
```

## Testing Checklist

### ✅ Basic Tests
- [ ] Generate periods for single INWARD
- [ ] Generate periods with INWARD then OUTWARD
- [ ] Verify monthly boundaries for Jan, Feb, Mar
- [ ] Check automatic splitting on mid-period transaction

### ✅ Status Tests
- [ ] ACTIVE status for ongoing stock
- [ ] PARTIAL_REMOVAL on outward transaction
- [ ] REMOVED if all stock removed
- [ ] Status transitions correct

### ✅ Rent Tests
- [ ] Rent = Quantity × Days × 10
- [ ] Total rent matches sum of periods
- [ ] Different quantities in different periods calculated separately

### ✅ Data Tests
- [ ] All transactions included in periods
- [ ] No gaps between periods
- [ ] Historical records marked correctly
- [ ] Transaction details attached to period entries

### ✅ UI Tests
- [ ] Table displays all periods
- [ ] Status badges color-coded correctly
- [ ] Rent calculated and displayed
- [ ] Transaction notes show in details column
- [ ] Summary cards show totals

## Common Queries

### Get all periods for an account
```javascript
db.ledger_time_state.find({ accountId: "booking-123" })
  .sort({ periodStartDate: 1 })
```

### Get active periods today
```javascript
db.ledger_time_state.find({
  accountId: "booking-123",
  periodStartDate: { $lte: "2026-04-16" },
  periodEndDate: { $gte: "2026-04-16" }
})
```

### Get historical records (past periods)
```javascript
db.ledger_time_state.find({
  accountId: "booking-123",
  historicalRecord: true
})
```

### Calculate total rent
```javascript
db.ledger_time_state.aggregate([
  { $match: { accountId: "booking-123" } },
  { $group: { _id: null, totalRent: { $sum: "$rentCalculated" } } }
])
```

## Rate Reference

- **Default Rate**: ₹10 per day per MT
- **Customization**: Set `ratePerDayPerMT` per period if needed
- **Calculation**: `Rent = Quantity × Days × Rate`

## Troubleshooting

### Periods not generating
**Check**: Transactions must have valid ISO dates (YYYY-MM-DD format)

### Mid-period transaction not splitting
**Check**: Transaction date should fall within month boundaries

### Missing periods
**Check**: Ensure first transaction is from desired start date

### Rent mismatch
**Check**: 
- Are quantities updating correctly INWARD/OUTWARD?
- Are days calculated as calendar days?
- Is rate ₹10 or customized?

## Documentation Files

1. **TIME_STATE_SYSTEM.md** - Full detailed guide (this folder)
2. **TIME_STATE_QUICK_REFERENCE.md** - This file
3. **Code comments** - In ledger-time-state-engine.ts

## Next Steps

1. Test with real transaction data
2. Integrate into dashboard reports
3. Create historical data migration script
4. Train users on new period-based view
5. Monitor rent calculations for accuracy

---

**Version**: 1.0  
**Last Updated**: 16 April 2026
