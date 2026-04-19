# Quick Reference: Using Grouped Ledger Components

## 1. Add Account Picker to a Booking Form

**Before (Old Way):**
```typescript
// src/app/dashboard/bookings/new/page.tsx
'use client';

import { useState } from 'react';

export default function NewBookingPage() {
  const [formData, setFormData] = useState({
    clientName: '',
    location: '',
  });

  return (
    <form>
      <input
        placeholder="Client Name"
        value={formData.clientName}
        onChange={(e) => setFormData({...formData, clientName: e.target.value})}
      />
      {/* More fields... */}
    </form>
  );
}
```

**After (New Way with Account Picker):**
```typescript
'use client';

import { useState } from 'react';
import { ClientAccountPicker } from '@/components/features/ledger/client-account-picker';
import type { IClientAccount } from '@/types/schemas';

export default function NewBookingPage() {
  const [selectedAccount, setSelectedAccount] = useState<IClientAccount | null>(null);
  const [formData, setFormData] = useState({
    accountId: '',      // This is the bookingId
    clientName: '',
    location: '',
  });

  const handleAccountSelect = (account: IClientAccount) => {
    setSelectedAccount(account);
    setFormData(prev => ({
      ...prev,
      accountId: account.bookingId,  // Store the unique ID
      clientName: account.clientName,
      location: account.clientLocation || ''
    }));
  };

  return (
    <form>
      <div className="mb-4">
        <label className="block text-sm font-semibold mb-2">Client Account</label>
        <ClientAccountPicker 
          onSelectAccount={handleAccountSelect}
          onCreateNew={(clientName) => console.log(`New account created: ${clientName}`)}
          placeholder="Search or create client account..."
        />
      </div>

      {selectedAccount && (
        <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-sm"><strong>Selected:</strong> {selectedAccount.clientName}</p>
          <p className="text-xs text-gray-600">Account ID: {selectedAccount.bookingId}</p>
        </div>
      )}

      {/* Rest of form fields... */}
      <input type="hidden" value={formData.accountId} />
    </form>
  );
}
```

---

## 2. Record Transactions with AccountId

**When recording inbound/outbound inventory:**

```typescript
// src/app/actions/inventory.ts (Server Action)
'use server';

import { getDb } from '@/lib/mongodb';

export async function recordTransaction(data: {
  accountId: string;        // ← Use this from booking form (= bookingId)
  commodityName: string;
  quantityMT: number;
  direction: 'INWARD' | 'OUTWARD';
  gatePass?: string;
}) {
  const db = await getDb();
  
  const transaction = {
    accountId: data.accountId,  // ← Link to ClientAccount.bookingId
    date: new Date().toISOString(),
    direction: data.direction,
    quantityMT: data.quantityMT,
    commodityName: data.commodityName,
    gatePass: data.gatePass || '',
    createdAt: new Date(),
  };

  await db.collection('transactions').insertOne(transaction);
  
  return { success: true };
}
```

---

## 3. Record Payments with AccountId

```typescript
// src/app/actions/billing.ts (Server Action)
'use server';

import { getDb } from '@/lib/mongodb';

export async function recordPayment(data: {
  accountId: string;    // ← From booking (= bookingId)
  amount: number;
  paymentMethod?: string;
  referenceNo?: string;
}) {
  const db = await getDb();
  
  const payment = {
    accountId: data.accountId,  // ← Link to ClientAccount.bookingId
    date: new Date().toISOString(),
    amount: data.amount,
    paymentMethod: data.paymentMethod || 'MANUAL',
    referenceNo: data.referenceNo || '',
    createdAt: new Date(),
  };

  await db.collection('payments').insertOne(payment);
  
  return { success: true };
}
```

---

## 4. View Unified Ledger

**Add a button to navigate to unified ledger report:**

```typescript
// In any component with account information
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

export function AccountActions({ accountId }: { accountId: string }) {
  return (
    <div className="flex gap-2">
      <Link
        href={`/dashboard/reports/unified/${accountId}`}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        <BarChart3 className="w-4 h-4" />
        View Unified Ledger
      </Link>
    </div>
  );
}
```

---

## 5. Search & Display Existing Accounts

**Server Action to find accounts:**

```typescript
// src/app/actions/consolidated-ledger.ts (Already available)
import { searchClientAccounts } from '@/app/actions/consolidated-ledger';

// Use in a component
const results = await searchClientAccounts('Reliance'); 
// Returns: IClientAccount[] matching "Reliance"
```

**Display in dropdown/list:**

```typescript
'use client';

import { searchClientAccounts } from '@/app/actions/consolidated-ledger';
import { useState } from 'react';

export function AccountsList() {
  const [accounts, setAccounts] = useState([]);

  const handleSearch = async (query: string) => {
    const result = await searchClientAccounts(query);
    if (result.success) {
      setAccounts(result.data || []);
    }
  };

  return (
    <div>
      <input 
        type="text"
        placeholder="Search accounts..."
        onChange={(e) => handleSearch(e.target.value)}
      />
      <ul>
        {accounts.map((account) => (
          <li key={account.bookingId}>
            {account.clientName}
            <span className="text-xs text-gray-500"> (ID: {account.bookingId})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 6. Create New Account Programmatically

```typescript
// src/app/actions/consolidated-ledger.ts (Already available)
import { createClientAccount } from '@/app/actions/consolidated-ledger';

// Use in a server action
const result = await createClientAccount(
  'New Client Ltd',
  'Mumbai, India',
  { phone: '9876543210', email: 'contact@newclient.com' }
);

if (result.success) {
  console.log(`New account created: ${result.data?.bookingId}`);
}
```

---

## 7. Data Model Quick Reference

```typescript
// ClientAccount (UNIQUE per booking ID)
{
  bookingId: "1701234567-abc123",  // ← Unique identifier
  clientName: "Reliance Industries",
  clientLocation: "Mundra Port, Gujarat",
  contactInfo: { phone, email },
  accountStatus: "ACTIVE",
  createdAt: Date,
  updatedAt: Date
}

// Transaction (LINKED via accountId)
{
  accountId: "1701234567-abc123",  // ← References ClientAccount.bookingId
  date: "2024-01-15T10:30:00Z",
  direction: "INWARD",
  quantityMT: 50,
  commodityName: "Rice",
  gatePass: "GP-12345",
  createdAt: Date
}

// Payment (LINKED via accountId)
{
  accountId: "1701234567-abc123",  // ← References ClientAccount.bookingId
  date: "2024-01-20T14:00:00Z",
  amount: 25000,
  paymentMethod: "BANK_TRANSFER",
  referenceNo: "TXN-98765",
  createdAt: Date
}
```

---

## 8. Testing the Flow

```bash
# 1. Test component in browser
→ http://localhost:3000/dashboard/bookings/new
→ Type to search accounts → See dropdown
→ Click "Create New" → New account created with bookingId
→ Select account → Form populated with accountId + clientName

# 2. Test unified report
→ http://localhost:3000/dashboard/reports/unified/[bookingId]
→ Should show specific account's transactions + payments
→ Verify ledger calculation is correct

# 3. Test end-to-end
→ Create booking with account picker
→ Record inbound (quantityMT = 50)
→ Record payment (amount = ₹10,000)
→ Navigate to unified ledger
→ Verify transactions + payment appear
→ Verify balance calculations are correct
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Account not showing in search | Check `accountStatus: 'ACTIVE'` in DB |
| New account creation fails | Verify MongoDB `client_accounts` collection exists |
| BookingId appears as `[object Object]` | Ensure `bookingId` is string, not object |
| Unified report shows no transactions | Check transactions have `accountId = bookingId` |
| Wrong date format in ledger | Date stored as ISO string, formatted at render time with date-fns |

---

## Files to Reference

- **Component Usage**: `src/components/features/ledger/client-account-picker.tsx`
- **Server Actions**: `src/app/actions/consolidated-ledger.ts`
- **Report View**: `src/app/dashboard/reports/unified/[bookingId]/page.tsx`
- **Type Definitions**: `src/types/schemas.ts` (IClientAccount, ITransaction, IPayment)
- **Full Integration Guide**: `GROUPED_LEDGER_INTEGRATION.md`
