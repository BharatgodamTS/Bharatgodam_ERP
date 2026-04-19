# TIME-STATE SYSTEM: Implementation Guide

## Overview

The **TIME-STATE SYSTEM** is a fundamental redesign of the ledger tracking mechanism that treats warehouse stock as a continuous, time-based state system rather than transaction-based intervals.

### Key Principle
**Ledger must track continuous presence over time, not just transaction-to-transaction intervals.**

---

## What Changed

### Old System (Transaction-Based)
```
Inward: 1 Jan (100 MT)
Outward: 20 Mar (partial)

Ledger showed:
- 1 Jan → 20 Mar: 100 MT (single interval)
```

**Problem**: No visibility into what happened month-by-month

### New System (TIME-STATE Based)
```
Inward: 1 Jan (100 MT)
Outward: 20 Mar (remove 30 MT, leaving 70 MT)

Ledger shows:
Period              Quantity  Status    Days
1 Jan – 31 Jan      100 MT    Active    31
1 Feb – 28 Feb      100 MT    Active    28
1 Mar – 20 Mar      100 MT    Active    20
20 Mar onwards      70 MT     Active    (continuing)
```

**Benefits**:
- ✅ Full continuity visibility
- ✅ Clear period-by-period breakdown
- ✅ **Automatic splitting** when transactions occur mid-period
- ✅ **History preserved** - past data never overwritten
- ✅ **Status tracking** - shows Active/Removed/Partial status

---

## Architecture

### 1. Data Model: `ILedgerTimeState`

```typescript
interface ILedgerTimeState {
  accountId: string;                    // Client account (bookingId)
  periodStartDate: string;              // ISO date (YYYY-MM-DD)
  periodEndDate: string;                // ISO date (YYYY-MM-DD)
  quantityMT: number;                   // Stock quantity during period
  status: 'ACTIVE' | 'REMOVED' | 'PARTIAL_REMOVAL' | 'CLOSED';
  reasonForChange: string;              // Why status changed
  affectedTransaction: {                // Transaction that caused change
    transactionId: string;
    direction: 'INWARD' | 'OUTWARD';
    quantity: number;
    date: string;
  };
  ratePerDayPerMT: number;             // ₹10/day/MT (can vary by period)
  rentCalculated: number;               // Pre-calculated rent for period
  historicalRecord: boolean;            // true = past (immutable)
  createdAt: Date;
}
```

### 2. Calculation Engine: `ledger-time-state-engine.ts`

**Core Function**: `generateTimeStateLedger(transactions, clientName)`

**Algorithm**:
```
1. Extract all transactions from first inward to today
2. Get monthly boundaries (1st → last day of each month)
3. For each month:
   a. Check if transactions occur in this month
   b. If YES → split period around transaction date
      - Create "before" period
      - Create "at transaction" entry (1-day)
      - Update stock quantity
      - Create "after" period
   c. If NO → extend period with same quantity
4. For each period: Calculate rent = quantity × days × daily_rate
5. Track status: ACTIVE (stock present) → REMOVED (no stock) → etc.
6. Mark historical periods as immutable
```

### 3. API Endpoint: `/api/ledger/time-state`

**POST**: Generate and save time-state entries
```typescript
POST /api/ledger/time-state
{
  accountId: "booking-123",
  clientName: "Client Name",
  transactions: [
    { date: "2026-01-01", direction: "INWARD", mt: 100, ... },
    { date: "2026-03-20", direction: "OUTWARD", mt: 30, ... }
  ]
}

Response:
{
  success: true,
  accountId: "booking-123",
  entriesCreated: 4,
  timeStateLedger: {
    totalPeriods: 4,
    timeStatePeriods: [...],
    totalRent: 18900
  }
}
```

**GET**: Retrieve time-state entries
```typescript
GET /api/ledger/time-state?accountId=booking-123

Response:
{
  success: true,
  entries: [
    { periodStartDate: "2026-01-01", periodEndDate: "2026-01-31", ... },
    ...
  ]
}
```

### 4. UI Component: `time-state-ledger-table.tsx`

Displays:
- Period number and date range
- Quantity (MT) for each period
- Number of days in period
- Status badge (color-coded)
- Transaction notes and reasons for changes
- Pre-calculated rent per period
- Total summary

---

## How It Works: Step-by-Step Example

### Scenario
```
Inward: 1 Jan 2026 (100 MT) - Commodity: Rice
Outward: 20 Mar 2026 (30 MT removal, 70 MT remains)
```

### Processing

**Step 1**: Sort transactions chronologically
```
1. 2026-01-01: INWARD 100 MT
2. 2026-03-20: OUTWARD 30 MT
```

**Step 2**: Identify month boundaries
```
- Month 1: 2026-01-01 to 2026-01-31
- Month 2: 2026-02-01 to 2026-02-28
- Month 3: 2026-03-01 to 2026-03-31
```

**Step 3**: Generate periods with automatic splitting

```
Month 1 (Jan):
├─ Transaction on 01 Jan
├─ Creates: 01 Jan – 31 Jan = 31 days, 100 MT, ACTIVE
└─ Rent: 100 × 10 × 31 = ₹31,000

Month 2 (Feb):
├─ No transactions
├─ Creates: 01 Feb – 28 Feb = 28 days, 100 MT, ACTIVE
└─ Rent: 100 × 10 × 28 = ₹28,000

Month 3 (Mar):
├─ Transaction on 20 Mar (OUTWARD 30 MT)
├─ Creates:
│  - 01 Mar – 19 Mar = 19 days, 100 MT, ACTIVE (before removal)
│  - 20 Mar (transaction day) = 1 day, 100 MT → 70 MT (PARTIAL_REMOVAL)
│  - 20 Mar onwards = continuing, 70 MT, ACTIVE (after removal)
└─ Combined Rent: (100×10×19) + (70×10×11) = ₹19,000 + ₹7,700
```

**Step 4**: Output

```
Period No  Start Date – End Date    Qty   Days  Rate      Rent        Status
────────────────────────────────────────────────────────────────────────────
1          01 Jan – 31 Jan         100   31   ₹10       ₹31,000     ACTIVE
2          01 Feb – 28 Feb         100   28   ₹10       ₹28,000     ACTIVE
3          01 Mar – 19 Mar         100   19   ₹10       ₹19,000     ACTIVE
4          20 Mar (transaction)     --    --   --        --          PARTIAL_REMOVAL
5          20 Mar – 31 Mar         70    11   ₹10       ₹7,700      ACTIVE

Total Rent: ₹85,700
```

---

## Key Features

### 1. **Automatic Period Splitting**
When a transaction occurs mid-period:
- Period BEFORE transaction (with original quantity)
- Transaction day marking (minimal 1-day entry)
- Period AFTER transaction (with new quantity)

Example:
```
If outward happens on Mar 15 (mid-month):
- 01 Mar – 14 Mar: Full quantity (ACTIVE)
- 15 Mar (transaction): Quantity changes
- 15 Mar – 31 Mar: Reduced quantity (ACTIVE)
```

### 2. **Historical Integrity**
- Past periods marked as `historicalRecord: true` (immutable)
- New updates only ADD entries, never DELETE past data
- Complete audit trail maintained
- Reconciliation possible for any past period

### 3. **Status Tracking**
```typescript
ACTIVE           → Stock is present in warehouse
PARTIAL_REMOVAL  → Stock quantity decreased (transaction day)
REMOVED          → All stock removed
CLOSED           → Period ended, no more activity
```

### 4. **Flexible Rate Application**
Each period can have different rates:
```typescript
ratePerDayPerMT: 10  // Standard rate (₹10/day/MT)
// Could vary by commodity, season, or customer agreement
```

---

## Integration Points

### 1. Consolidated Ledger Action
[src/app/actions/consolidated-ledger.ts](src/app/actions/consolidated-ledger.ts)

```typescript
// Now returns both systems
const response = await getConsolidatedLedger(bookingId);

response.data = {
  ledgerSummary,        // Traditional ledger (for backward compatibility)
  timeStateLedger,      // NEW: TIME-STATE SYSTEM ledger
  // ... other data
}
```

### 2. Dashboard Display
[src/app/dashboard/reports/unified/[bookingId]/page.tsx](src/app/dashboard/reports/unified/[bookingId]/page.tsx)

```typescript
import { TimeStateLedgerTable } from '@/components/features/ledger/time-state-ledger-table';

<TimeStateLedgerTable timeStateLedger={data.timeStateLedger} />
```

### 3. Database Storage
MongoDB collection: `ledger_time_state`

```javascript
db.ledger_time_state.createIndex({ accountId: 1, periodStartDate: 1 })
db.ledger_time_state.createIndex({ historicalRecord: 1 })
```

---

## Migration Strategy

### Phase 1: Parallel Calculation
- Keep existing transaction-based ledger
- Run TIME-STATE calculation in parallel
- Compare results for validation
- Both systems available in UI

### Phase 2: Gradual Transition
- Set TIME-STATE as primary display
- Keep traditional ledger as fallback
- Gather user feedback
- Refine splitting logic if needed

### Phase 3: Full Adoption
- Make TIME-STATE the official calculation method
- Archive old transaction-based data
- Update all reports and exports
- Complete historical data migration

---

## Usage Instructions

### For Developers

**1. Generate TIME-STATE Ledger**
```typescript
import { generateTimeStateLedger } from '@/lib/ledger-time-state-engine';

const timeStateLedger = generateTimeStateLedger(transactions, clientName);
console.log(timeStateLedger);
// {
//   totalPeriods: 5,
//   timeStatePeriods: [...],
//   totalRent: 85700,
//   totalQuantityDays: 8570
// }
```

**2. Save to Database**
```typescript
const response = await fetch('/api/ledger/time-state', {
  method: 'POST',
  body: JSON.stringify({
    accountId: bookingId,
    clientName: 'Client Name',
    transactions: [...],
  }),
});
```

**3. Retrieve and Display**
```typescript
const response = await fetch(`/api/ledger/time-state?accountId=${bookingId}`);
const { entries } = await response.json();

<TimeStateLedgerTable timeStateLedger={entries} />
```

### For Users

1. **View TIME-STATE Ledger**
   - Go to Dashboard → Reports → [Client Account]
   - Scroll to "TIME-STATE SYSTEM Ledger" section
   - View period-by-period breakdown

2. **Understand Periods**
   - Each row = one calendar period (usually monthly)
   - If transactions occur mid-period, that period is split
   - `Status` column shows if stock is active or being removed

3. **Verify Rent Calculation**
   - Rent = Quantity (MT) × Days × Rate (₹10/day/MT)
   - Verify each period's calculation in the table
   - Total Rent = sum of all period rents

---

## Advanced Features

### Custom Period Boundaries
Currently using monthly boundaries. Can be customized:
```typescript
// Weekly boundaries
function getWeekBoundaries(fromDate, toDate) { ... }

// Daily boundaries (for detailed analysis)
function getDayBoundaries(fromDate, toDate) { ... }

// Custom date ranges
function getCustomBoundaries(fromDate, toDate, periodDays) { ... }
```

### Multi-Commodity Tracking
Currently aggregates all commodities. Can extend to:
```typescript
interface ILedgerTimeStateByItem {
  commodityId: string;      // Add commodity tracking
  commodityName: string;
  // ... rest same as ILedgerTimeState
}
```

### Rent Adjustments
Can apply rate changes per period:
```typescript
{
  periodStartDate: "2026-01-01",
  periodEndDate: "2026-01-31",
  ratePerDayPerMT: 10,      // Standard rate
  adjustments: [
    { type: 'DISCOUNT', amount: 5, reason: 'Seasonal' },
    { type: 'SURCHARGE', amount: 2, reason: 'Hazmat' },
  ],
  effectiveRate: 12,        // 10 + (-5) + 2
}
```

---

## Troubleshooting

### Issue: Periods not splitting correctly
**Solution**: Check transaction dates format (must be ISO YYYY-MM-DD)

### Issue: Missing intermediate periods
**Solution**: Ensure all transactions are included in the query; check date range

### Issue: Rent calculation differs from expected
**Solution**: Verify daily rate constant (should be ₹10); check quantity updates

### Issue: Historical data being overwritten
**Solution**: Mark past periods as `historicalRecord: true` before new calculations

---

## Files Modified/Created

### New Files
- `src/lib/ledger-time-state-engine.ts` - Core calculation engine
- `src/app/api/ledger/time-state/route.ts` - API endpoints
- `src/components/features/ledger/time-state-ledger-table.tsx` - UI component
- `TIME_STATE_SYSTEM.md` - This documentation

### Modified Files
- `src/types/schemas.ts` - Added `ILedgerTimeState` interface
- `src/app/actions/consolidated-ledger.ts` - Integrated TIME-STATE calculation
- `src/app/dashboard/reports/unified/[bookingId]/page.tsx` - Added UI component (pending)

---

## Verification Checklist

- [ ] Schema `ILedgerTimeState` added to `src/types/schemas.ts`
- [ ] Ledger engine `ledger-time-state-engine.ts` created and tested
- [ ] API route `/api/ledger/time-state` implemented
- [ ] Consolidated ledger action generates TIME-STATE ledger
- [ ] UI component displays periods correctly
- [ ] Period splitting works for mid-period transactions
- [ ] Historical records are marked and preserved
- [ ] Rent calculation matches expected values
- [ ] Status transitions are correct (ACTIVE → PARTIAL → CLOSED)
- [ ] Database indexes created for performance
- [ ] Dashboard shows TIME-STATE table alongside traditional ledger

---

## Example Test Cases

### Test 1: Simple Inward Only
```
Transaction: 1 Jan 2026 INWARD 100 MT
Expected: 1 Jan – Today: 100 MT, ACTIVE
Rent: 100 × 10 × (days from Jan 1 to today)
```

### Test 2: Inward then Complete Removal
```
Transactions:
  - 1 Jan 2026: INWARD 100 MT
  - 31 Mar 2026: OUTWARD 100 MT

Expected:
  - 1 Jan – 31 Jan: 100 MT, ACTIVE
  - 1 Feb – 28 Feb: 100 MT, ACTIVE
  - 1 Mar – 31 Mar: 100 MT → 0 MT, PARTIAL → REMOVED
```

### Test 3: Partial Removal Mid-Period
```
Transactions:
  - 1 Jan 2026: INWARD 100 MT
  - 15 Mar 2026: OUTWARD 30 MT
  
Expected periods:
  - 1 Jan – 31 Jan: 100 MT
  - 1 Feb – 28 Feb: 100 MT
  - 1 Mar – 14 Mar: 100 MT
  - 15 Mar onwards: 70 MT
```

### Test 4: Multiple Inward/Outward
```
Transactions:
  - 1 Jan: INWARD 100 MT
  - 15 Feb: INWARD 50 MT
  - 20 Mar: OUTWARD 75 MT
  
Quantities: 100 → 150 → 75
Status transitions: ACTIVE → INCREASED → PARTIAL → ACTIVE
```

---

## Performance Considerations

### Database Indexes
```javascript
// Navigate to your MongoDB client and run:
db.ledger_time_state.createIndex({ 
  accountId: 1, 
  periodStartDate: 1 
});

db.ledger_time_state.createIndex({ 
  accountId: 1, 
  periodEndDate: 1 
});

db.ledger_time_state.createIndex({ 
  historicalRecord: 1 
});
```

### Query Optimization
- Always filter by `accountId` first
- Use date range queries for period lookups
- Cache generated ledgers for 24 hours
- Batch period calculations when possible

---

## Future Enhancements

1. **Predictive Status**: Show estimated removal dates based on trends
2. **Alerts**: Notify when stock reaches low thresholds
3. **Comparisons**: Compare periods across years
4. **Custom Rates**: Variable rates per commodity/season
5. **Multi-Location**: Track same stock across warehouses
6. **Integration**: Connect with purchase orders and sales forecasts

---

**Last Updated**: 16 April 2026  
**Version**: 1.0  
**Status**: Ready for Implementation
