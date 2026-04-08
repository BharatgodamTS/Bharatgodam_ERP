# Invoice PDF Generator - Quick Reference

## ✅ What's Been Implemented

A **production-grade, modular PDF invoice generator** matching the "POSSIBLE WAREHOUSING LLP" warehouse invoice layout.

---

## 📦 Files Created

### Core System
| File | Purpose |
|------|---------|
| `src/lib/invoice/types.ts` | TypeScript interfaces for all invoice data |
| `src/lib/invoice/formatters.ts` | Currency formatting, amount-in-words conversion |
| `src/lib/invoice/validators.ts` | Data validation & integrity checks |
| `src/lib/invoice/html-generator.ts` | Professional HTML template (pixel-perfect layout) |
| `src/lib/invoice/pdf-generator.ts` | Puppeteer-based PDF conversion |
| `src/lib/invoice/index.ts` | Main export file |
| `src/lib/invoice/sample-data.ts` | 2 pre-built example invoices |

### Integration Points
| File | Purpose |
|------|---------|
| `src/app/actions/invoices-pdf.ts` | Server actions for invoice generation |
| `src/app/api/invoices/generate-pdf/route.ts` | REST API endpoint |
| `src/components/features/invoices/invoice-pdf-exporter.tsx` | React component with download UI |

### Documentation
| File | Purpose |
|------|---------|
| `INVOICE_GENERATOR_GUIDE.md` | Complete implementation manual |
| `INVOICE_QUICK_REFERENCE.md` | This file |

---

## 🎯 Key Features

✅ **Professional Layout**
- Header with company branding & contact
- Customer billing information
- Invoice metadata (number, date, GSTIN)
- Detailed line items table
- Financial summary with amount-in-words

✅ **Smart Formatting**
- Indian Rupee currency (₹)
- Amount to words conversion (3508 → "Rupees Three Thousand Five Hundred Eight Only")
- Date formatting (DD/MM/YYYY)
- Number formatting with thousand separators

✅ **Validation System**
- GSTIN format validation
- IFSC code validation
- Date format verification
- Financial calculation integrity checks
- Complete line item validation

✅ **Modular Architecture**
- Separate concerns: types, formatting, validation, HTML, PDF
- Reusable components
- Error handling throughout

✅ **Multiple Integration Points**
- Server actions (Next.js)
- REST API endpoint
- React component
- Direct function calls

---

## 🚀 Usage Examples

### 1. Generate PDF Directly
```typescript
import { generateInvoicePDF, sampleInvoiceData } from '@/lib/invoice';

const pdfBuffer = await generateInvoicePDF(sampleInvoiceData);
// Use pdfBuffer for download or storage
```

### 2. From Server Action
```typescript
import { generateInvoice } from '@/app/actions/invoices-pdf';

const pdf = await generateInvoice(invoiceData);
```

### 3. From API Endpoint
```bash
POST /api/invoices/generate-pdf
Content-Type: application/json

{ invoiceData }
```

### 4. From React Component
```jsx
import InvoicePDFExporter from '@/components/features/invoices/invoice-pdf-exporter';

<InvoicePDFExporter invoiceData={data} fileName="invoice.pdf" />
```

---

## 📋 Invoice Data Structure

```typescript
interface InvoiceData {
  company: {
    name: string;        // "POSSIBLE WAREHOUSING LLP"
    address: string;
    email: string;
    website: string;
    phone: string;
    gstin: string;       // 24AAWFP7490F1ZN
  };
  
  customer: {
    name: string;        // "VIRAL TRADING"
    shopNo?: string;
    area: string;
    marketYard?: string;
    city: string;
    district: string;
    state: string;
    pincode?: string;
  };
  
  metadata: {
    invoiceNo: string;   // "PWL/25-26/0578"
    invoiceDate: string; // "28/02/2026"
  };
  
  lineItems: [{
    whCode: string;
    billFrom: string;
    itemName: string;
    corNo: string;
    billTo: string;
    quantity: number;
    weight: number;      // MT
    month: string;
    days: number;
    ratePerUnit: number;
    storageChargesPerMonth: number;
    amount: number;
  }];
  
  financial: {
    basicTotal: number;
    roundOff: number;
    netAmount: number;
  };
  
  bankDetails: {
    bankName: string;
    branchName: string;
    accountNumber: string;
    ifscCode: string;    // "KKBK0000001"
  };
  
  termsAndConditions: [{
    title: string;
    description: string;
  }];
  
  authorizedBy?: string;
  notes?: string;
}
```

---

## 🔧 Utility Functions

### Formatting
```typescript
formatCurrency(3508)                    // "₹ 3,508.00"
amountInWords(3508)                     // "Rupees Three Thousand Five Hundred Eight Only"
formatDate('28/02/2026')                // "28 February 2026"
formatNumber(50.110, 3)                 // "50.110"
roundToNearestRupee(3507.50)            // { rounded: 3508, roundOff: 0.50 }
```

### Validation
```typescript
const validator = new InvoiceValidator();
const { valid, errors } = validator.validate(invoiceData);

if (!valid) {
  errors.forEach(e => console.log(e.field, e.message));
}
```

---

## 📊 PDF Output

**Format:** A4 (210mm × 297mm)
**DPI:** 96 (screen resolution)
**Margins:** 10mm all sides
**Font:** Arial, sans-serif
**File Size:** ~50-100KB per invoice

**Sections:**
1. Header (Company name, contact info)
2. Recipient (Bill To details)
3. Invoice Metadata (Invoice No, Date, GSTIN)
4. Line Items Table
5. Financial Summary
6. Bank Details
7. Terms & Conditions
8. Signatory Section

---

## ✨ Validation Features

✅ **Company:**
- Name required
- GSTIN format (24 chars: 2 digits + 5 letters + 4 digits + letter + alphanumeric + Z + alphanumeric)

✅ **Customer:**
- Name required
- City/District required

✅ **Metadata:**
- Invoice number required
- Date format: DD/MM/YYYY

✅ **Line Items:**
- At least one item required
- No negative quantities or amounts
- Item names required

✅ **Financial:**
- basicTotal = sum of all line item amounts
- netAmount = basicTotal + roundOff
- Validates within 0.01 paise tolerance

✅ **Bank Details:**
- IFSC format: 4 letters + 0 + 6 alphanumeric (e.g., "KKBK0000001")

---

## 🔄 Batch Processing

```typescript
import { generateInvoicesPDF } from '@/lib/invoice';

const invoices = [invoice1, invoice2, invoice3];

// Generate and save all
const pdfMap = await generateInvoicesPDF(
  invoices, 
  './public/invoices'
);

// Map structure: invoice # → PDF buffer
for (const [invoiceNo, buffer] of pdfMap) {
  console.log(`Generated: ${invoiceNo}`);
}
```

---

## 🧹 Resource Management

```typescript
import { closeBrowser } from '@/lib/invoice';

// ... generate invoices ...

// Free up browser resources
await closeBrowser();
```

The browser instance is reused for performance but should be closed when all invoices are generated.

---

## 🌐 API Response

### Success (200)
- Content-Type: application/pdf
- Body: Binary PDF data
- Headers: Content-Disposition (filename)

### Validation Error (400)
```json
{
  "success": false,
  "errors": [
    {
      "field": "company.name",
      "message": "Company name is required"
    }
  ]
}
```

### Server Error (500)
```json
{
  "success": false,
  "error": "Failed to generate invoice: [details]"
}
```

---

## 📝 Sample Invoices

Two complete example invoices included:

**Sample 1:**
- Invoice No: PWL/25-26/0578
- Date: 28/02/2026
- Customer: VIRAL TRADING
- Items: Onions, Potatoes, Garlic (3 items)
- Total: ₹ 3,507.50

**Sample 2:**
- Invoice No: PWL/25-26/0579
- Date: 01/03/2026
- Customer: FRESH MERCHANTS CORPORATION
- Items: Mangoes, Apples (2 items)
- Total: ₹ 3,800.00

Load via:
```typescript
import { sampleInvoiceData, sampleInvoiceData2 } from '@/lib/invoice/sample-data';
```

---

## 🔐 Security & Best Practices

✅ **Data Validation:** All inputs validated before PDF generation
✅ **Error Handling:** Comprehensive try-catch and error messages
✅ **Resource Cleanup:** Browser instance properly closed
✅ **Type Safety:** Full TypeScript support
✅ **Modular Design:** Easy to extend and maintain

---

## 🎨 Styling Details

| Element | Style |
|---------|-------|
| Company Name | 18pt, Bold, Centered |
| Section Headers | 9pt, Bold, Grey background |
| Table Headers | 8pt, Bold, Light grey background (#f3f4f6) |
| Table Body | 9pt, Regular |
| Currency | Green (#0a7e46) for amounts |
| Borders | Light grey (#d1d5db), 1px solid |
| Font | Arial, sans-serif |

---

## 🆘 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Invalid GSTIN format" | Ensure format: 24AAWFP7490F1ZN (case-sensitive) |
| "Invalid IFSC code" | Format: 4 letters + 0 + 6 alphanumeric |
| "Net amount mismatch" | Verify: netAmount = basicTotal + roundOff |
| "Date format error" | Use DD/MM/YYYY format |
| PDF file empty | Ensure validation passes before generation |

---

## 📚 Additional Resources

- **Full Guide:** [INVOICE_GENERATOR_GUIDE.md](./INVOICE_GENERATOR_GUIDE.md)
- **Type Definitions:** [src/lib/invoice/types.ts](./src/lib/invoice/types.ts)
- **Sample Data:** [src/lib/invoice/sample-data.ts](./src/lib/invoice/sample-data.ts)
- **API Route:** [src/app/api/invoices/generate-pdf/route.ts](./src/app/api/invoices/generate-pdf/route.ts)

---

## 🎉 Integration Checklist

- [x] Type definitions created
- [x] Formatting utilities implemented
- [x] Validation system built
- [x] HTML template generated
- [x] PDF conversion working
- [x] Server actions set up
- [x] API endpoint created
- [x] React component built
- [x] Sample data provided
- [x] Documentation complete
- [x] Code compiled successfully

---

**Status:** ✅ Ready for Production
**Dependencies:** Puppeteer (installed)
**Build Status:** Compiles successfully
**Last Updated:** April 8, 2026
