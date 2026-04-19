# Daily Average Inventory Ledger - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Create MongoDB Collection (if needed)
```javascript
// Run in MongoDB shell
db.createCollection("payments");
db.payments.createIndex({ clientName: 1, date: -1 });
db.bookings.createIndex({ clientName: 1, date: -1 });
```

### Step 2: Import and Use

```tsx
// In your page or component
import { LedgerCalculator } from '@/components/features/ledger';

export default function LedgerPage({ params }: { params: { clientId: string } }) {
  return (
    <div className="p-6">
      <LedgerCalculator clientId={params.clientId} />
    </div>
  );
}
```

### Step 3: Access the Page
Navigate to: `http://localhost:3000/reports/ledger/YOUR_CLIENT_NAME`

---

## 📊 Component Breakdown

### Import Individual Components
```tsx
import { 
  LedgerTable,
  InvoiceSummary, 
  TransactionTimeline, 
  PaymentHistory 
} from '@/components/features/ledger';

// Use individually
<InvoiceSummary 
  totalRent={100900} 
  totalPaid={50000} 
  balance={50900} 
/>
```

---

## 🔧 API Endpoints

### Fetch Client Ledger
```bash
GET /api/reports/ledger/ABC%20Grains%20Inc

Response:
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

### Record Payment
```bash
POST /api/reports/ledger

Body:
{
  "clientName": "ABC Grains Inc",
  "amount": 25000,
  "date": "2026-04-11"
}

Response:
{
  "success": true,
  "paymentId": "507f1f77bcf86cd799439011",
  "message": "Payment recorded successfully"
}
```

### Update Booking
```bash
PATCH /api/bookings/[bookingId]

Body:
{
  "date": "2026-01-11",
  "clientName": "Updated Name",
  "mt": 105
}

Response:
{
  "success": true,
  "message": "Booking updated successfully",
  "booking": {...}
}
```

---

## 📈 Sample Test Data

```javascript
// Create test booking
db.bookings.insertOne({
  clientName: "Test Client",
  direction: "INWARD",
  date: "2026-01-10",
  mt: 100,
  commodityName: "WHEAT",
  gatePass: "GP001",
  warehouseName: "Warehouse A",
  location: "Zone A",
  status: "APPROVED",
  createdAt: new Date()
});

// Create second booking
db.bookings.insertOne({
  clientName: "Test Client",
  direction: "OUTWARD",
  date: "2026-01-25",
  mt: 40,
  commodityName: "WHEAT",
  gatePass: "GP002",
  warehouseName: "Warehouse A",
  location: "Zone A",
  status: "APPROVED",
  createdAt: new Date()
});

// Create payment record
db.payments.insertOne({
  clientName: "Test Client",
  amount: 10000,
  date: "2026-02-01",
  recordedBy: "admin@example.com",
  createdAt: new Date()
});
```

Then visit: `/reports/ledger/Test%20Client`

---

## 🎨 Component Features

### LedgerCalculator
- Fetches and calculates ledger
- Manages all state
- Provides refresh & export buttons
- Responsive layout

### LedgerTable
- Step-by-step calculation details
- 8 columns with hover effects
- Color-coded transaction badges
- Summary statistics

### InvoiceSummary
- 3 metric cards
- Color-coded balance status
- Icons with gradient backgrounds
- Real-time calculations

### TransactionTimeline
- Chronological transaction list
- Visual timeline with icons
- INWARD/OUTWARD badges
- Cumulative statistics

### PaymentHistory
- All recorded payments
- "Add Payment" button
- Total payments footer
- Toast notifications

---

## 🔐 Customization

### Change Rent Rate (₹/day/MT)
**File**: `src/lib/ledger-engine.ts` line 46

```typescript
// Default: ₹10 per day per MT
const RATE_PER_DAY_PER_MT = 10; 

// Change to (e.g., ₹12)
const RATE_PER_DAY_PER_MT = 12;
```

### Support Commodity-Specific Rates
```typescript
function getRate(commodity: string): number {
  const rates: Record<string, number> = {
    'WHEAT': 10,
    'RICE': 12,
    'COTTON': 15,
  };
  return rates[commodity] || 10;
}
```

### Add Warehouse Filter
```typescript
// In src/app/api/reports/ledger/route.ts
const transactions = await db
  .collection('bookings')
  .find({
    clientName: clientId,
    warehouseName: warehouseName, // Add this
    direction: { $in: ['INWARD', 'OUTWARD'] },
  })
  .sort({ date: 1 })
  .toArray();
```

---

## ⚠️ Important Notes

### Date Format
- Dates must be ISO format: `YYYY-MM-DD`
- Example: `2026-04-11`

### Client Name Matching
- Transaction and payment records matched by `clientName`
- Match is case-sensitive
- Use consistent naming

### Stock Validation
- Outward quantity cannot exceed current stock
- System prevents negative inventory

### Floating Point Precision
- All currency values rounded to 2 decimal places
- Uses `Math.round(value * 100) / 100`

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| No ledger data | Check clientName matches exactly between bookings & payments |
| Incorrect rent | Verify transaction dates are ISO format (YYYY-MM-DD) |
| 404 on /api/reports | Ensure `payments` collection exists in MongoDB |
| Component not rendering | Check `react-hot-toast` is installed and configured |
| Dates showing wrong | Verify date strings in database are ISO format |

---

## 📁 File Structure Overview

```
✅ CREATED:
  src/lib/ledger-engine.ts
  src/app/api/reports/ledger/route.ts
  src/components/features/ledger/
    ├── ledger-calculator.tsx ⭐ (main component)
    ├── ledger-table.tsx
    ├── invoice-summary.tsx
    ├── transaction-timeline.tsx
    ├── payment-history.tsx
    └── index.ts
  src/app/reports/ledger/[clientId]/page.tsx
  LEDGER_IMPLEMENTATION_GUIDE.md
  LEDGER_SYSTEM_SUMMARY.md
  LEDGER_QUICK_START.md (this file)

✅ UPDATED:
  src/app/api/bookings/route.ts (added PATCH handler)
```

---

## 📞 Quick Support

**Algorithm Question?** See: `LEDGER_IMPLEMENTATION_GUIDE.md`

**Component Usage?** See: Individual component files (JSDoc comments)

**API Details?** See: `src/app/api/reports/ledger/route.ts`

**Database Schema?** See: `LEDGER_IMPLEMENTATION_GUIDE.md` → Database Schema Requirements

---

## ✨ Key Features Summary

✅ Automatic bucket-based rent calculation  
✅ Step-by-step ledger breakdown  
✅ Payment tracking and reconciliation  
✅ CSV export functionality  
✅ Real-time add payment form  
✅ Edit booking details (PATCH API)  
✅ Responsive Tailwind design  
✅ Toast error notifications  
✅ Loading/empty states  
✅ Precision currency handling  

---

**Ready to go!** Your Daily Average Inventory Ledger system is fully implemented and ready for use. 🎉
