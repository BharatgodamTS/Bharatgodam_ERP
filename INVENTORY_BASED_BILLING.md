# Inventory-Based Billing System
## Month-Wise Invoice Calculation per Calendar Days

### 📊 System Overview

**Billing Method:** Inventory-based (not transaction-based)  
**Calculation Frequency:** Monthly, per calendar days  
**Rate Formula:** `Monthly Charge = (Inventory Level × Daily Rate × Days) / 30`

---

## 🔸 January 2026 Example Scenario

### Transaction Timeline
```
Jan 15: Inward Transaction A  → +10 MT WHEAT
Jan 15: Inward Transaction B  → +20 MT WHEAT
Jan 26: Outward             → -5 MT (from any combination)
Jan 28: Inward Transaction C  → +12 MT WHEAT
```

### Commodity Rate
```
Commodity:    WHEAT
Rate:         ₹87/MT/month
Daily Rate:   ₹87 ÷ 30 = ₹2.90 per MT per day
```

---

## 📈 Inventory Levels Throughout January

```
Jan 1-14:   0 MT (no stock)
Jan 15-25:  30 MT (10 + 20)
Jan 26-27:  25 MT (30 - 5)
Jan 28-31:  37 MT (25 + 12)
```

---

## 💰 Billing Calculation by Period

### Period 1: January 15-25 (11 days)
```
Inventory:     30 MT
Daily Rate:    ₹2.90/MT/day
Days:          11 days
Calculation:   30 MT × ₹2.90 × 11 days = ₹957.00
```

### Period 2: January 26-27 (2 days)
```
Inventory:     25 MT (after outward on Jan 26)
Daily Rate:    ₹2.90/MT/day
Days:          2 days
Calculation:   25 MT × ₹2.90 × 2 days = ₹145.00
```

### Period 3: January 28-31 (4 days)
```
Inventory:     37 MT (after inward on Jan 28)
Daily Rate:    ₹2.90/MT/day
Days:          4 days
Calculation:   37 MT × ₹2.90 × 4 days = ₹429.20
```

---

## 📋 Monthly Invoice Summary - January 2026

| Period | Start | End | Days | Inventory (MT) | Daily Rate (₹/MT) | Charge (₹) |
|--------|-------|-----|------|---|---|---|
| 1 | Jan 15 | Jan 25 | 11 | 30 | 2.90 | 957.00 |
| 2 | Jan 26 | Jan 27 | 2 | 25 | 2.90 | 145.00 |
| 3 | Jan 28 | Jan 31 | 4 | 37 | 2.90 | 429.20 |
| **TOTAL** | | | **17** | **Peak: 37 MT** | | **₹1,531.20** |

---

## 🔄 How It Differs from Transaction-Based Billing

### ❌ OLD (Transaction-Based)
Each transaction billed separately:
- Transaction A: 10 MT × ₹87 ÷ 30 × 47 days = ₹1,363.00 (billed for Jan 15 - Feb 15)
- Transaction B: 20 MT × ₹87 ÷ 30 × 47 days = ₹2,726.00 (billed for Jan 15 - Feb 15)
- Transaction C: 12 MT × ₹87 ÷ 30 × 32 days = ₹1,161.60 (billed for Jan 28 - Feb 28)
- **January charge: Variable (partial months)**
- **No correlation to actual inventory held**

### ✅ NEW (Inventory-Based)
Monthly charge based on actual stock levels:
- Each day's inventory calculated separately
- Charges reflect real warehouse occupancy
- Clear month-wise invoice
- Fair billing: More days with inventory = More charges

---

## 🗓️ Month-Wise Invoice Breakdown

### For January 2026 (31 days in month)

**Client:** Sureshwar Corporation  
**Warehouse:** [Warehouse Location]  
**Commodity:** WHEAT  

| Metric | Value |
|--------|-------|
| Days in Month | 31 |
| Days with Inventory | 17 |
| Peak Inventory | 37 MT |
| Inward Transactions | 3 |
| Outward Transactions | 1 |
| Rate | ₹87/MT/month (₹2.90/MT/day) |
| **Total Invoice Amount** | **₹1,531.20** |

### Detailed Periods
```
Period 1: Jan 15-25 (11 days) → 30 MT × ₹2.90 × 11 = ₹957.00
Period 2: Jan 26-27 (2 days)  → 25 MT × ₹2.90 × 2  = ₹145.00
Period 3: Jan 28-31 (4 days)  → 37 MT × ₹2.90 × 4  = ₹429.20
```

---

## 📊 For Other Months

### February 2026 (28 days, leap year adjustment)
```
Daily Rate = ₹87 ÷ 28 = ₹3.11 per MT per day (adjusted for 28 days)

Example: If 30 MT held all 28 days:
Charge = 30 MT × ₹3.11 × 28 = ₹2,611.20
```

### March 2026 (31 days)
```
Daily Rate = ₹87 ÷ 31 = ₹2.81 per MT per day

Example: If 25 MT held all 31 days:
Charge = 25 MT × ₹2.81 × 31 = ₹2,176.75
```

---

## 🔧 Implementation Details

### Key Components

1. **InventoryChange Event**
   - Date of transaction
   - Quantity (positive for inward, negative for outward)
   - Type (INWARD or OUTWARD)

2. **InventoryBillingPeriod**
   - Start/End dates
   - Days in period
   - Inventory level
   - Daily rate
   - Period charge

3. **InventoryBillingBreakdown**
   - Month and year
   - All billing periods
   - Total amount
   - Peak inventory
   - Days with stock

### Calculation Algorithm

```
1. Collect all inward/outward events for the month
2. Sort by date ascending
3. For each day with inventory changes:
   a. Apply all changes (update inventory level)
   b. Calculate days until next change or month end
   c. If inventory > 0: Add charge for this period
      Charge = inventory × daily_rate × days
4. Sum all period charges
5. Return detailed breakdown
```

### Paise-Level Precision

All calculations use paise (₹ × 100) to avoid floating-point errors:
- Multiply all values by 100
- Perform integer arithmetic
- Round final result
- Convert back to rupees

---

## 🎯 API Usage

### Endpoint
```
GET /api/invoices/inventory-based?clientId=&warehouseId=&commodityId=&month=2026-01
```

### Response Example
```json
{
  "success": true,
  "data": {
    "monthYear": "2026-01",
    "client": { "id": "client-123" },
    "commodity": { "name": "WHEAT" },
    "ratePerMTPerMonth": 87,
    "dailyRatePerMT": 2.90,
    "billing": {
      "monthYear": "2026-01",
      "daysInMonth": 31,
      "daysWithInventory": 17,
      "peakInventory": 37,
      "periods": [
        {
          "startDate": "2026-01-15",
          "endDate": "2026-01-25",
          "days": 11,
          "inventory": 30,
          "dailyRate": 2.90,
          "charge": 957.00,
          "calculation": "30 MT × ₹2.90/MT/day × 11 days = ₹957.00"
        },
        // ... more periods
      ],
      "totalAmount": 1531.20
    }
  }
}
```

---

## ✅ Benefits of Inventory-Based Billing

1. **Fair & Transparent** - Charges match actual inventory held
2. **Monthly Clarity** - Clear month-wise invoices with calendar days
3. **Flexible** - Automatically adjusts for Feb 28/29 vs 30-31 day months
4. **Auditable** - Each period shows quantity, days, and calculation
5. **System Efficient** - Single monthly charge instead of per-transaction

---

## 📝 Notes

- All dates use calendar dates (timezone-aware UTC)
- Minimum 1 day charged if same-day transaction
- No GST applied (storage rent at bare rate)
- Peak inventory tracked for reporting
- Zero inventory periods not charged
