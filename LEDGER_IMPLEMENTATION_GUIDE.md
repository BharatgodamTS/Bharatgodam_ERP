# Daily Average Inventory Ledger - Implementation Guide

## System Overview

The Daily Average Inventory Ledger system calculates warehouse storage rent using a "Bucket" algorithm that processes transactions chronologically. This guide explains the implementation, usage, and customization.

## How the Bucket Algorithm Works

### The Concept
Rent = ₹10 per day per MT (Metric Ton)

### Algorithm Steps
1. **Sort Transactions**: All INWARD/OUTWARD transactions are sorted by date
2. **Calculate Intervals**: For each pair of consecutive transactions, calculate:
   - Days elapsed = Date B - Date A
   - Current Stock (in MT)
   - Rent for interval = Stock × Rate (₹10) × Days
3. **Final Period**: From the last transaction date to today, calculate remaining rent
4. **Sum Up**: Total rent is the sum of all period rents

### Example Calculation

```
Transaction Log:
- 2026-01-10: INWARD 100 MT  (Gate Pass: GP001)
- 2026-01-15: OUTWARD 30 MT  (Gate Pass: GP002)
- 2026-02-01: INWARD 50 MT   (Gate Pass: GP003)

Ledger Steps:
1. Period: 2026-01-10 to 2026-01-15
   - Days: 5
   - Stock: 100 MT (for this period)
   - Rate: ₹10/day/MT
   - Rent: 100 × 10 × 5 = ₹5,000
   - Transaction: INWARD (GP001)

2. Period: 2026-01-15 to 2026-02-01
   - Days: 17
   - Stock: 70 MT (100 - 30 from previous transaction)
   - Rate: ₹10/day/MT
   - Rent: 70 × 10 × 17 = ₹11,900
   - Transaction: OUTWARD (GP002)

3. Period: 2026-02-01 to Today (2026-04-11)
   - Days: 70
   - Stock: 120 MT (70 + 50 from previous transaction)
   - Rate: ₹10/day/MT
   - Rent: 120 × 10 × 70 = ₹84,000
   - Transaction: INWARD (GP003)

Total Rent: ₹5,000 + ₹11,900 + ₹84,000 = ₹100,900
Total Paid: ₹50,000 (from payments collection)
Outstanding Balance: ₹50,900
```

## Component Architecture

### File Structure
```
src/
├── lib/
│   └── ledger-engine.ts                 # Calculation logic & types
├── app/api/
│   └── reports/ledger/route.ts         # API handlers (GET, POST)
├── components/features/ledger/
│   ├── ledger-calculator.tsx           # Main orchestrator component
│   ├── ledger-table.tsx                # Displays ledger steps
│   ├── invoice-summary.tsx             # Summary cards (Rent, Paid, Balance)
│   ├── transaction-timeline.tsx        # Visual timeline of transactions
│   ├── payment-history.tsx             # Payment records & add new payments
│   └── index.ts                        # Barrel exports
```

## Key Components

### 1. LedgerCalculator (Main Container)
**File**: `src/components/features/ledger/ledger-calculator.tsx`

The orchestrator that:
- Fetches ledger data from `/api/reports/ledger/[clientId]`
- Manages loading/error states
- Coordinates all sub-components
- Provides export to CSV functionality

**Usage**:
```tsx
import { LedgerCalculator } from '@/components/features/ledger';

export default function ClientLedgerPage({ params }: { params: { clientId: string } }) {
  return (
    <div className="p-6">
      <LedgerCalculator 
        clientId={params.clientId} 
        clientName="ABC Grains Inc"
      />
    </div>
  );
}
```

### 2. LedgerTable
**File**: `src/components/features/ledger/ledger-table.tsx`

Displays the step-by-step rent calculation in a table format.

**Columns**:
- `#` - Step number
- `Start Date` - Interval start
- `End Date` - Interval end
- `Days` - Number of days in interval
- `Qty (MT)` - Stock quantity during interval
- `Rate` - Fixed ₹10/day/MT
- `Rent (₹)` - Calculated rent for interval
- `Transaction` - Associated INWARD/OUTWARD badge

### 3. InvoiceSummary
**File**: `src/components/features/ledger/invoice-summary.tsx`

Three key metrics cards:
- **Total Rent** - Total storage cost (primary)
- **Total Paid** - Amount received from client
- **Outstanding Balance** - Total Rent - Total Paid (color-coded)

**Status Indicators**:
- 🟢 Outstanding (positive balance) - Amount due
- 🟢 Settled (zero balance)
- 🟡 Overpaid (negative balance) - Credit to adjust

### 4. TransactionTimeline
**File**: `src/components/features/ledger/transaction-timeline.tsx`

Visual timeline of all INWARD and OUTWARD transactions with:
- Chronological order
- Direction badges (📥 Inward / 📤 Outward)
- Quantity and commodity info
- Cumulative statistics

### 5. PaymentHistory
**File**: `src/components/features/ledger/payment-history.tsx`

Payment records with ability to:
- View all payments with dates and amounts
- Add new payment entries
- See total payments received

## Database Schema Requirements

### Collections Needed

#### `bookings` (Existing)
```typescript
{
  _id: ObjectId,
  clientName: string,
  direction: 'INWARD' | 'OUTWARD',
  date: string, // ISO date
  mt: number,
  commodityName: string,
  gatePass: string,
  // ... other fields
}
```

#### `payments` (New)
```typescript
{
  _id: ObjectId,
  clientName: string,
  amount: number,
  date: string, // ISO date
  recordedBy: string,
  createdAt: Date,
}
```

Add the `payments` collection to MongoDB if it doesn't exist.

## API Endpoints

### GET /api/reports/ledger/[clientId]
Fetches full ledger for a client.

**Response**:
```json
{
  "success": true,
  "data": {
    "clientName": "ABC Grains Inc",
    "ledgerSteps": [...],
    "totalRent": 100900,
    "totalPaid": 50000,
    "balance": 50900,
    "paymentHistory": [...],
    "calculationDate": "2026-04-11"
  }
}
```

### POST /api/reports/ledger
Records a new payment.

**Request**:
```json
{
  "clientName": "ABC Grains Inc",
  "amount": 25000,
  "date": "2026-04-11"
}
```

**Response**:
```json
{
  "success": true,
  "paymentId": "...",
  "message": "Payment recorded successfully"
}
```

### PATCH /api/bookings/[bookingId]
Updates a booking (for edit mode).

## Customization Guide

### Change Rent Rate
**File**: `src/lib/ledger-engine.ts`

```typescript
// Line ~38
const RATE_PER_DAY_PER_MT = 10; // Change this value

// If different commodities have different rates:
function getRate(commodity: string): number {
  const rates: Record<string, number> = {
    'WHEAT': 12,
    'RICE': 15,
    'COTTON': 20,
  };
  return rates[commodity] || 10;
}
```

### Handle Multiple Warehouses
The current system keys by `clientName`. To support per-warehouse rates:

```typescript
// Modify ledger calculation
const ledgerData = await db.collection('bookings').find({
  clientName: clientId,
  warehouseName: warehouseName, // Add this filter
  direction: { $in: ['INWARD', 'OUTWARD'] },
}).toArray();
```

### Add Custom Filters
Modify the API route to support date ranges:

```typescript
// GET /api/reports/ledger/[clientId]?startDate=2026-01-01&endDate=2026-04-11
const { searchParams } = new URL(req.url);
const startDate = searchParams.get('startDate');
const endDate = searchParams.get('endDate');

const query: any = { clientName: clientId };
if (startDate || endDate) {
  query.date = {};
  if (startDate) query.date.$gte = startDate;
  if (endDate) query.date.$lte = endDate;
}
```

## Floating-Point Precision

The engine handles currency rounding automatically using:

```typescript
function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100; // Rounds to 2 decimal places
}
```

All monetary values are rounded to prevent JavaScript floating-point errors.

## Example Page Implementation

See `src/app/reports/ledger/[clientId]/page.tsx` for a complete page example.

## Testing the System

### Sample Test Data
```javascript
// Create test booking
db.bookings.insertOne({
  clientName: "Test Client",
  direction: "INWARD",
  date: "2026-01-10",
  mt: 100,
  commodityName: "WHEAT",
  gatePass: "GP001",
  // ... other fields
})

// Create test payment
db.payments.insertOne({
  clientName: "Test Client",
  amount: 5000,
  date: "2026-01-15",
  recordedBy: "admin@example.com",
  createdAt: new Date()
})
```

Then access: `/reports/ledger/Test Client`

## Performance Considerations

- **Transaction Sorting**: O(n log n) - reasonable for typical warehouse volumes
- **API Caching**: Consider adding Redis caching for frequently accessed clients
- **Database Indexing**: Index `bookings.clientName` and `payments.clientName`

```javascript
db.bookings.createIndex({ clientName: 1, date: -1 })
db.payments.createIndex({ clientName: 1, date: -1 })
```

## Troubleshooting

### No ledger data showing
1. Verify transactions exist in `bookings` collection
2. Ensure `direction` field is exactly 'INWARD' or 'OUTWARD'
3. Check `clientName` matches exactly (case-sensitive)

### Incorrect rent calculation
1. Verify date format is ISO (YYYY-MM-DD)
2. Check stock never goes negative
3. Confirm RATE_PER_DAY_PER_MT constant

### Payments not showing
1. Verify entries exist in `payments` collection
2. Check `clientName` matches booking records
3. Ensure date format is YYYY-MM-DD

