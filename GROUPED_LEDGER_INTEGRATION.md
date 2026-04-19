# Grouped Ledger Accounts (Booking ID) - Integration Guide

## Overview
Implementation of unified ledger accounts grouped by unique `bookingId`, replacing single-commodity tracking with multi-commodity aggregation. This enables proper handling of clients with multiple warehouses/locations under one account.

## Completed Components

### 1. ✅ Schema Updates (`src/types/schemas.ts`)
- **IClientAccount**: Unique booking account with `bookingId` (string, indexed)
  - Properties: `bookingId`, `clientName`, `clientLocation`, `contactInfo`, `accountStatus`, `createdAt`, `updatedAt`
- **ITransaction**: Transaction record linked via `accountId` (= `bookingId`)
  - Properties: `accountId`, `date`, `direction`, `quantityMT`, `commodityName`, `gatePass`, `createdAt`
- **IPayment**: Payment record linked via `accountId` (= `bookingId`)
  - Properties: `accountId`, `date`, `amount`, `createdAt`

**Key Pattern**: `accountId` in transactions/payments always references `ClientAccount.bookingId`

---

### 2. ✅ Server Actions (`src/app/actions/consolidated-ledger.ts`)

#### `getConsolidatedLedger(bookingId: string)`
Fetches all transactions and payments for an account, calculates unified ledger:
- Queries `transactions` collection: `{accountId: bookingId}`
- Queries `payments` collection: `{accountId: bookingId}`
- Calls `calculateLedger()` with combined array (treats all commodities as single stream)
- Returns: Account metadata + ledger summary + commodity breakdown

**Response Type**: `ConsolidatedLedgerResponse`
```typescript
{
  success: boolean;
  data?: {
    account: IClientAccount;
    transactions: Transaction[];
    payments: Payment[];
    ledgerSummary: { steps: LedgerStep[], totalRent, totalPayments };
    commoditySummary: { commodity, totalMT, inboundMT, outboundMT }[];
  }
}
```

#### `searchClientAccounts(searchQuery: string)`
Search for existing accounts by client name (case-insensitive, limit 10):
- Used by dropdown picker for "Use Existing Account"
- Returns array of matching `IClientAccount[]`

#### `createClientAccount(clientName, clientLocation?, contactInfo?)`
Create new client account:
- Generates unique `bookingId` (timestamp + random suffix)
- Returns newly created account with `bookingId`
- Used by dropdown picker for "Create New Account"

---

### 3. ✅ UI Component - ClientAccount Picker (`src/components/features/ledger/client-account-picker.tsx`)

**Features**:
- Search-as-you-type dropdown (300ms debounce)
- "Use Existing Account" with display of ID and location
- "Create New Account" button
- Selection displays account details (name + bookingId)
- Toast notifications for success/error states

**Usage**:
```typescript
import { ClientAccountPicker } from '@/components/features/ledger/client-account-picker';

<ClientAccountPicker 
  onSelectAccount={(account) => {
    // account.bookingId is the unique identifier
    setSelectedBookingId(account.bookingId);
  }}
  onCreateNew={(clientName) => {
    // Optional callback when new account created
  }}
/>
```

---

### 4. ✅ Unified Report View Page (`src/app/dashboard/reports/unified/[bookingId]/page.tsx`)

**Route**: `/dashboard/reports/unified/[bookingId]`

**Layout**:
1. **Account Header**: Client name, bookingId, location, creation date
2. **Key Metrics Cards**: Inbound/Outbound/Balance MT, Balance Due (₹)
3. **Commodity Breakdown**: Grid of all commodities with individual MT totals
4. **Consolidated Ledger Table**: All transactions (all commodities combined)
5. **Payment History**: All payments received
6. **Financial Summary**: Total Rent Due | Total Payments | Balance Due

**Notable Features**:
- Server-side data fetching with authentication check
- Dynamic calculation of commodity summary from raw transactions
- Balance Due highlighting (red if due, green if settled)
- Back-to-reports navigation

---

## Integration Steps

### Step 1: MongoDB Collections & Indexes
Create collections with indexes:
```bash
# Collections needed (if not exists):
- client_accounts  → Index: bookingId (UNIQUE)
- transactions     → Index: accountId
- payments        → Index: accountId
```

### Step 2: Update New Booking Form
Replace client name input with `ClientAccountPicker`:

```typescript
// OLD: Simple text input
<input value={clientName} onChange={...} />

// NEW: Account picker
<ClientAccountPicker 
  onSelectAccount={(account) => {
    setFormData(prev => ({
      ...prev,
      accountId: account.bookingId,  // Store bookingId, not name
      clientName: account.clientName
    }))
  }}
/>
```

### Step 3: Update Transaction Recording
When recording inbound/outbound, use `accountId` (bookingId):
```typescript
// In inventory.ts or similar
const transaction = {
  accountId: formData.accountId,  // This is the bookingId
  date: new Date(),
  direction: 'INWARD' | 'OUTWARD',
  quantityMT: 25,
  commodityName: 'Rice',
  gatePass: 'GP-123'
};
```

### Step 4: Update Payment Recording
Link payments to account:
```typescript
// In billing.ts or similar
const payment = {
  accountId: formData.accountId,  // This is the bookingId
  date: new Date(),
  amount: 5000,
};
```

### Step 5: Add Navigation Link to Reports
Add button/link to view unified ledger:
```typescript
<Link href={`/dashboard/reports/unified/${account.bookingId}`}>
  View Unified Ledger
</Link>
```

---

## Data Flow Diagram

```
New Booking Form
  ↓ (select/create account)
ClientAccountPicker
  ↓ (returns IClientAccount with bookingId)
Store accountId = account.bookingId
  ↓
Record Transactions/Payments (with accountId)
  ↓
Unified Report View: /reports/unified/[bookingId]
  ↓
getConsolidatedLedger(bookingId)
  ↓
Query DB: transactions{accountId}, payments{accountId}
  ↓
calculateLedger() - treat all commodities as one stream
  ↓
Display LedgerTable, PaymentHistory, Commodity Summary
```

---

## Key Differences from Previous Multi-Account Aggregation

| Aspect | Old (Case-insensitive) | New (Grouped by bookingId) |
|--------|---|---|
| **Aggregation Key** | Client name (string) | Booking ID (string, unique) |
| **Collision Handling** | Case-insensitive regex | Impossible (unique bookingId) |
| **Transactions Link** | Queried by clientName regex | Queried by accountId (= bookingId) |
| **Entry Point** | API route `/api/reports/ledger/[clientId]` | Page route `/reports/unified/[bookingId]` |
| **Multiple Matches** | ALL matching names aggregated | Single exact account |
| **New Account Creation** | Not available in picker | Built-in "Create New" option |

---

## Testing Checklist

- [ ] Search client accounts → displays matching accounts
- [ ] Create new account → generates unique bookingId
- [ ] Select existing account → displays account details
- [ ] Navigate to `/reports/unified/[bookingId]` → loads specific account
- [ ] Ledger table shows transactions for only that account
- [ ] Payment history shows payments for only that account
- [ ] Commodity summary calculates correctly
- [ ] Balance due calculated correctly
- [ ] All date formats display as DD/MM/YYYY

---

## Migration Notes

### For Existing Bookings
If migrating existing single-commodity bookings to grouped accounts:
1. Create `ClientAccount` for each existing booking
2. Extract `bookingId` from created account
3. Update existing transactions/payments to set `accountId = bookingId`
4. Verify ledger calculations match before/after

### Backward Compatibility
All existing ledger components (LedgerTable, PaymentHistory, etc.) remain unchanged and work with the unified data.
