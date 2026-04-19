# Inward/Outward Transactions & Monthly Invoices - Implementation Guide

## What's Been Fixed & Added

### 1. ✅ **Inward/Outward Transactions Now Showing in Reports**

#### Problem
Transactions were being saved in a format that didn't match the expectations of the reports and ledger systems.

#### Solution
Updated the **`POST /api/transactions`** endpoint to:
- Accept transactions in proper format (direction: INWARD/OUTWARD, quantityMT, accountId)
- Automatically create/link client accounts
- Save to MongoDB `transactions` collection with the correct schema
- **Automatically regenerate TIME-STATE ledger** after each transaction is recorded
- Support both legacy field names and new field names

#### New Endpoint Signature
```typescript
POST /api/transactions
{
  type: "Inward" | "Outward",      // Auto-converted to INWARD/OUTWARD
  clientId: string,
  clientName: string,                // NEW: Creates account if doesn't exist
  bookingId?: string,                // NEW: Account ID (auto-generated if not provided)
  commodityName: string,             // NEW: Commodity being stored
  quantity || quantityMT: number,    // MT (Metric Tons)
  date: string,                      // ISO date (YYYY-MM-DD)
  gatePass?: string,                 // NEW: Gate pass reference
  warehouseId?: string,
  commodityId?: string,
}

Response:
{
  success: true,
  transactionId: ObjectId,
  transaction: {
    id: string,
    accountId: string,
    direction: "INWARD" | "OUTWARD",
    quantityMT: number,
    date: string,
  }
}
```

#### What Happens When Transaction is Recorded
1. ✅ Transaction saved to `transactions` collection
2. ✅ TIME-STATE ledger automatically regenerated
3. ✅ Ledger periods stored in `ledger_time_state` collection
4. ✅ Client account created (if doesnt exist)
5. ✅ Ready for reports and invoicing

### 2. ✅ **Monthly Invoices with PDF Download**

#### New Files Created

**`src/app/actions/monthly-invoices.ts`**
```typescript
// Generate monthly invoices based on TIME-STATE ledger
export async function getClientMonthlyInvoicesTimeState(clientName: string)

// Record payment against account
export async function recordMonthlyPayment(
  accountId: string,
  amount: number,
  paymentMethod?: string,
  referenceNumber?: string
)

// Get current account balance
export async function getAccountBalance(accountId: string)
```

**`src/app/actions/monthly-invoice-pdf.ts`**
```typescript
// Generate invoice as HTML
export function generateMonthlyInvoiceHTML(invoice: MonthlyInvoiceData): string

// Convert HTML to PDF (requires puppeteer)
export async function generateMonthlyInvoicePDF(invoice: MonthlyInvoiceData): Promise<Buffer>
```

**Updated `src/app/dashboard/client-invoices/page.tsx`**
- Now uses TIME-STATE ledger data
- Shows monthly breakdown with periods
- Download invoices as HTML (can be printed as PDF)
- Record payments directly from invoice page
- Shows account balance summary

#### Monthly Invoice Structure
```typescript
interface MonthlyInvoiceData {
  bookingId: string;                 // Account ID
  clientName: string;
  month: string;                     // "Jan", "Feb", etc.
  year: number;
  periods: Array<{
    startDate: string;
    endDate: string;
    quantityMT: number;
    daysTotal: number;
    rentTotal: number;                // ₹ amount
    status: string;                   // "ACTIVE"
  }>;
  warehouseName?: string;
  totalRent: number;                 // Monthly rent
  previousBalance?: number;
  currentPayments?: number;
  newBalance?: number;
  invoiceDate: string;
}
```

### 3. 📊 **Updated Client Invoices Page Features**

The invoice page now displays:

1. **Client Selection** - Dropdown to select client
2. **Account Balance Summary** - Shows:
   - Total Storage Rent
   - Total Payments Received
   - Outstanding Balance
   - Quick payment entry form

3. **Monthly Invoice Cards** - For each month:
   - Month and year
   - Warehouse location
   - Number of periods
   - Total monthly rent
   - Downloadable as HTML

4. **Period Breakdown Table** - Shows:
   - Period dates (From - To)
   - Quantity stored (MT)
   - Number of days
   - Rent amount (₹)
   - Status badge (ACTIVE/PARTIAL/REMOVED)

5. **Monthly Summary** - Quick overview:
   - Previous balance
   - Monthly rent
   - Payments made
   - Current balance

---

## How to Use

### Step 1: Record a Transaction
```typescript
// Create inward transaction
POST /api/transactions
{
  "type": "Inward",
  "clientName": "Shruti Mehata",
  "commodityName": "Wheat",
  "quantityMT": 100,
  "date": "2026-01-15",
  "gatePass": "GP-2026-001",
  "clientId": "client-123",
  "warehouseId": "warehouse-1"
}

// Create outward transaction (same API)
POST /api/transactions
{
  "type": "Outward",
  "clientName": "Shruti Mehata",
  "commodityName": "Wheat",
  "quantityMT": 30,          // Partial removal
  "date": "2026-03-20",
  "gatePass": "GP-2026-002",
  "clientId": "client-123",
  "warehouseId": "warehouse-1"
}
```

### Step 2: View Monthly Invoices
1. Go to **Dashboard → Client Invoices**
2. Select client from dropdown
3. View account balance summary
4. See monthly invoices with period breakdown
5. Click **Download** to get invoice as HTML

### Step 3: Record Payment
1. In Account Summary section, enter amount in "NEW PAYMENT" field
2. Click the pay button
3. Payment recorded with today's date
4. Balance updates automatically

### Step 4: View in Reports
1. Transactions now appear in **Dashboard → Reports**
2. Filter by date, commodity, warehouse
3. See all inward/outward movements

---

## TIME-STATE Ledger Auto-Generation

When a transaction is posted, the system automatically:

1. **Generates periods** from first inward to today
2. **Splits periods** when outward transactions occur
3. **Stores in database** for fast retrieval
4. **Calculates rent** based on quantity × days × ₹10/day/MT

### Example Auto-Generation
```
Transaction 1: Jan 1 - INWARD 100 MT
Transaction 2: Mar 20 - OUTWARD 30 MT

Auto-Generated Periods:
- Jan 1-31:   100 MT, Active     (₹31,000)
- Feb 1-28:   100 MT, Active     (₹28,000)
- Mar 1-19:   100 MT, Active     (₹19,000)
- Mar 20+:    70 MT, Active      (₹7,000/11 days)
```

---

## PDF Download

### Current Implementation
Invoices are generated as **HTML** that can be:
- Downloaded and opened in browser
- Printed to PDF using Ctrl+P → "Save as PDF"
- Emailed directly

### Optional: Full PDF Generation
If you want automatic PDF generation, install puppeteer:
```bash
npm install puppeteer
```

Then the system will generate native PDFs instead of HTML.

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── transactions/
│   │       └── route.ts               [UPDATED] Auto-saves TIME-STATE ledger
│   ├── actions/
│   │   ├── monthly-invoices.ts        [NEW] Invoice generation from TIME-STATE
│   │   └── monthly-invoice-pdf.ts     [NEW] PDF generation
│   └── dashboard/
│       └── client-invoices/
│           └── page.tsx               [UPDATED] Uses TIME-STATE data
├── lib/
│   ├── ledger-time-state-engine.ts    [EXISTING] Calculation engine
│   └── invoice/
│       └── pdf-generator.ts           [EXISTING] PDF utilities
└── types/
    └── schemas.ts                      [EXISTING] Data models
```

---

## Database Collections

### 1. `transactions` Collection
Stores all inward/outward transactions
```javascript
{
  _id: ObjectId,
  accountId: "ACC-123",
  direction: "INWARD",           // INWARD or OUTWARD
  date: "2026-01-15",
  quantityMT: 100,
  commodityName: "Wheat",
  gatePass: "GP-001",
  clientName: "Shruti Mehata",
  clientId: "client-123",
  warehouseId: "warehouse-1",
  status: "COMPLETED",
  createdAt: Date,
  updatedAt: Date
}
```

### 2. `ledger_time_state` Collection
Auto-generated periods (updated on each transaction)
```javascript
{
  _id: ObjectId,
  accountId: "ACC-123",
  periodStartDate: "2026-01-01",
  periodEndDate: "2026-01-31",
  quantityMT: 100,
  status: "ACTIVE",
  rentCalculated: 31000,
  historicalRecord: true,
  createdAt: Date,
  updatedAt: Date
}
```

### 3. `payments` Collection
Stores payment records
```javascript
{
  _id: ObjectId,
  accountId: "ACC-123",
  date: "2026-04-10",
  amount: 50000,
  paymentMethod: "BANK_TRANSFER",
  referenceNumber: "TXN-1234",
  recordedBy: "user@email.com",
  createdAt: Date
}
```

---

## Testing Checklist

### Test 1: Create Inward Transaction
- [ ] Navigate to Inward Transaction page
- [ ] Fill in: Client Name, Commodity, Quantity, Date
- [ ] Submit
- [ ] Check transaction appears in API response
- [ ] Verify TIME-STATE ledger generated
- [ ] Check MongoDB `transactions` collection
- [ ] Check MongoDB `ledger_time_state` collection

### Test 2: Create Outward Transaction
- [ ] Navigate to Outward Transaction page
- [ ] Fill in: Same client, Commodity, Quantity (less than inward), Date (after inward)
- [ ] Submit
- [ ] Verify TIME-STATE ledger **splits** for the month
- [ ] Check MongoDB for new periods

### Test 3: View in Reports
- [ ] Go to Dashboard → Reports
- [ ] Should see inward transaction in table
- [ ] Should see outward transaction in table
- [ ] Filter by date range
- [ ] Verify correct counts

### Test 4: View Monthly Invoice
- [ ] Go to Dashboard → Client Invoices
- [ ] Select the client
- [ ] Should see monthly breakdown
- [ ] Should see periods table with status
- [ ] Verify rent calculations: Qty × Days × 10

### Test 5: Record Payment
- [ ] From Client Invoices, enter payment amount
- [ ] Click Record Payment button
- [ ] Check balance updates
- [ ] Verify payment in MongoDB `payments` collection

### Test 6: Download Invoice
- [ ] Click Download button on invoice
- [ ] Should download as HTML file
- [ ] Open in browser and verify:
  - Client name correct
  - Month correct
  - Periods detailed correctly
  - Rent totals correct
  - Balance summary correct

### Test 7: Multiple Transactions
- [ ] Create inward Jan 1: 100 MT
- [ ] Create inward Feb 15: 50 MT (total 150 MT)
- [ ] Create outward Mar 10: 75 MT (remaining 75 MT)
- [ ] Check TIME-STATE shows quantity changes:
  - Jan: 100 MT
  - Feb 1-14: 100 MT
  - Feb 15+: 150 MT
  - Mar 1-9: 150 MT
  - Mar 10+: 75 MT

---

## Troubleshooting

### Issue: Transactions not showing in reports
**Solution:**
1. Check MongoDB `transactions` collection - records should exist
2. Verify `direction` field is "INWARD" or "OUTWARD" (uppercase)
3. Verify `accountId` matches a record in `client_accounts`
4. Check browser console for API errors
5. Verify user is logged in and has permissions

### Issue: Invoices not showing
**Solution:**
1. Verify TIME-STATE ledger was created: Check `ledger_time_state` collection
2. Verify transaction dates are correct (ISO format YYYY-MM-DD)
3. Check `getClientMonthlyInvoicesTimeState` in browser console
4. Verify account exists in `client_accounts` collection

### Issue: PDF not downloading
**Solution:**
1. Check browser's download folder
2. Verify file size (should be > 10KB)
3. Try different browser if Chrome fails
4. Check browser console for errors
5. If returning HTML instead of PDF:
   - This is normal if puppeteer not installed
   - User can print HTML to PDF manually

### Issue: Balance not updating after payment
**Solution:**
1. Refresh page after recording payment
2. Check payment was saved: `db.payments.findOne({}, {sort: {createdAt: -1}})`
3. Verify correct `accountId` is used
4. Check `recordMonthlyPayment` action for errors in console

---

## Next Steps

1. **Test thoroughly** with the checklist above
2. **Verify data** in MongoDB collections
3. **Add UI endpoints** for creating transactions in dashboard (if not already done)
4. **Implement PDF printing** (optional: install puppeteer)
5. **Create batch invoice generation** (for multiple clients)
6. **Set up email** to send invoices to clients
7. **Add payment gateway** integration (online payments)

---

## API Reference

### Create Transaction
```
POST /api/transactions
Headers: Authorization: Bearer {token}
Body: {
  type: "Inward|Outward",
  clientName: string,
  quantityMT: number,
  commodityName: string,
  date: string (ISO),
  gatePass?: string,
  clientId?: string,
  bookingId?: string,
  warehouseId?: string,
  commodityId?: string,
}
```

### Get Transactions
```
GET /api/transactions?clientId=xxx&direction=INWARD&startDate=2026-01-01&endDate=2026-12-31
```

### Get Monthly Invoices
```
POST /app/actions/monthly-invoices.ts
Function: getClientMonthlyInvoicesTimeState(clientName: string)
Returns: MonthlyInvoiceData[]
```

### Record Payment
```
POST /app/actions/monthly-invoices.ts
Function: recordMonthlyPayment(accountId, amount, paymentMethod?, refNumber?)
Returns: { success: true/false, ... }
```

---

**Version:** 1.0  
**Last Updated:** 16 April 2026  
**Status:** Ready for Testing
