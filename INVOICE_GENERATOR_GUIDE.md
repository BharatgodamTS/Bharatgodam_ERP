# Invoice PDF Generator - Complete Guide

Professional, pixel-perfect PDF invoice generator for WMS Pro. Matches "POSSIBLE WAREHOUSING LLP" warehouse invoice layout.

## 📁 Project Structure

```
src/lib/invoice/
├── index.ts                    # Main export file
├── types.ts                    # TypeScript interfaces
├── formatters.ts               # Currency & formatting utilities
├── validators.ts               # Data validation logic
├── html-generator.ts           # HTML template generation
├── pdf-generator.ts            # Puppeteer PDF conversion
└── sample-data.ts              # Example invoice data

src/app/api/invoices/
└── generate-pdf/
    └── route.ts                # API endpoint for PDF generation

src/app/actions/
└── invoices-pdf.ts             # Server actions for invoices

src/components/features/invoices/
└── invoice-pdf-exporter.tsx    # React component for UI
```

---

## 🚀 Quick Start

### 1. Installation

Puppeteer is already installed. If not, run:

```bash
npm install puppeteer
```

### 2. Basic Usage

```typescript
import { generateInvoicePDF, sampleInvoiceData } from '@/lib/invoice';

// Generate PDF as buffer
const pdfBuffer = await generateInvoicePDF(sampleInvoiceData);

// Save to file
const pdfPath = './invoices/sample.pdf';
await generateInvoicePDF(sampleInvoiceData, pdfPath);
```

### 3. Using in Next.js Server Actions

```typescript
// From src/app/actions/invoices-pdf.ts
import { generateInvoice } from '@/app/actions/invoices-pdf';

export default async function InvoicePage() {
  const pdfBuffer = await generateInvoice(invoiceData);
  // Handle download or response
}
```

### 4. Using in API Routes

```bash
POST /api/invoices/generate-pdf
Content-Type: application/json

{
  "company": { ... },
  "customer": { ... },
  "metadata": { ... },
  "lineItems": [ ... ],
  "financial": { ... },
  "bankDetails": { ... },
  "termsAndConditions": [ ... ]
}
```

### 5. Using React Component

```jsx
import InvoicePDFExporter from '@/components/features/invoices/invoice-pdf-exporter';

export default function InvoiceDetail() {
  return (
    <div>
      <InvoicePDFExporter 
        invoiceData={invoiceData} 
        fileName="invoice-123.pdf"
      />
    </div>
  );
}
```

---

## 📋 Data Structure

### CompanyInfo

```typescript
interface CompanyInfo {
  name: string;              // e.g., "POSSIBLE WAREHOUSING LLP"
  address: string;           // Full company address
  email: string;             // contact@example.com
  website: string;           // www.company.com
  phone: string;             // +91-XX-XXXX-XXXX
  gstin: string;             // 24AAWFP7490F1ZN (unique)
  logo?: string;             // Base64 or URL (optional)
}
```

### CustomerInfo

```typescript
interface CustomerInfo {
  name: string;              // e.g., "VIRAL TRADING"
  shopNo?: string;           // Shop No 15-16 (optional)
  area: string;              // Vegetable Market Yard
  marketYard?: string;       // Central Market Yard (optional)
  city: string;              // Mumbai
  district: string;          // Mumbai
  state: string;             // Maharashtra
  pincode?: string;          // 400001 (optional)
  contact?: string;          // +91-XXXX-XXXXX (optional)
  gstin?: string;            // Customer GSTIN (optional)
}
```

### LineItem

```typescript
interface LineItem {
  whCode: string;                    // WHC-001
  billFrom: string;                  // Warehouse 1
  itemName: string;                  // Onions Storage
  corNo: string;                     // COR-12345
  billTo: string;                    // Bill Location 1
  quantity: number;                  // 250
  weight: number;                    // 12.5 (MT)
  month: string;                     // Feb-2026
  days: number;                      // 28
  ratePerUnit: number;               // 50.0
  storageChargesPerMonth: number;    // 1500.0
  amount: number;                    // Total amount
}
```

### FinancialSummary

```typescript
interface FinancialSummary {
  basicTotal: number;        // Sum of all line items
  roundOff: number;          // Rounding adjustment
  netAmount: number;         // basicTotal + roundOff
}
```

### BankDetails

```typescript
interface BankDetails {
  bankName: string;          // "Kotak Mahindra Bank"
  branchName: string;        // "Mumbai - Fort Branch"
  accountNumber: string;     // "1234567890123456"
  ifscCode: string;          // "KKBK0000001"
}
```

### InvoiceData (Complete)

```typescript
interface InvoiceData {
  company: CompanyInfo;
  customer: CustomerInfo;
  metadata: InvoiceMetadata;
  lineItems: LineItem[];
  financial: FinancialSummary;
  bankDetails: BankDetails;
  termsAndConditions: TermsAndCondition[];
  authorizedBy?: string;     // Signatory name
  notes?: string;            // Additional notes
}
```

---

## 🔧 Utility Functions

### Formatters

```typescript
import { 
  formatCurrency,          // ₹ 3,508.00
  amountInWords,           // "Rupees Three Thousand Five Hundred Eight Only"
  formatDate,              // "28 February 2026"
  formatNumber,            // "3,508.00"
  roundToNearestRupee      // { rounded: 3508, roundOff: -0.50 }
} from '@/lib/invoice';

// Examples
formatCurrency(3508);                    // "₹ 3,508.00"
amountInWords(3508);                     // "Rupees Three Thousand Five Hundred Eight Only"
formatDate('28/02/2026');                // "28 February 2026"
roundToNearestRupee(3507.50);            // { rounded: 3508, roundOff: 0.50 }
```

### Validators

```typescript
import { InvoiceValidator } from '@/lib/invoice';

const validator = new InvoiceValidator();
const { valid, errors } = validator.validate(invoiceData);

if (!valid) {
  errors.forEach(error => {
    console.log(`${error.field}: ${error.message}`);
  });
}
```

Validation checks:
- ✓ Company name & GSTIN format
- ✓ Customer information completeness
- ✓ Invoice date format (DD/MM/YYYY)
- ✓ Line item data integrity
- ✓ Financial calculations (basicTotal = sum of items)
- ✓ Bank details & IFSC format

---

## 📊 Sample Invoice Data

Pre-built example invoice (matches "POSSIBLE WAREHOUSING LLP" format):

```typescript
import { sampleInvoiceData, sampleInvoiceData2 } from '@/lib/invoice/sample-data';

const pdfBuffer = await generateInvoicePDF(sampleInvoiceData);
```

**Sample Invoice 1:**
- Invoice No: PWL/25-26/0578
- Date: 28/02/2026
- 3 line items (Onions, Potatoes, Garlic)
- Total: ₹ 3,507.50

**Sample Invoice 2:**
- Invoice No: PWL/25-26/0579
- Date: 01/03/2026
- 2 line items (Mangoes, Apples)
- Total: ₹ 3,800.00

---

## 📄 PDF Layout

### Header Section
- Company name (centered, bold, 18pt)
- Right-aligned contact info and GSTIN

### Recipient Section
- "Bill To:" with customer details
- Company GSTIN display

### Invoice Metadata
- Invoice Number (boxed)
- Invoice Date (boxed)
- GSTIN (boxed)

### Line Items Table
Columns: WH Code | Bill From | Item Name | COR No. | Bill To | Qty | Weight | Month | Days | Rate Per | Storage Chg/Month | Amount

Totals row with:
- Total Quantity
- Total Weight (MT)
- Total Amount

### Financial Summary
- Amount in Words (e.g., "Rupees Three Thousand Five Hundred Eight Only")
- Summary Table: Basic Total, Round Off, **NET AMOUNT**

### Banking Section
- Bank Name
- Branch Name
- Account Number
- IFSC Code

### Terms & Conditions
- 3 standard T&Cs with descriptions

### Signatory Section
- Authorized signatory name and title

---

## 🔐 Validation & Error Handling

All invoices are validated before PDF generation:

```typescript
try {
  const pdf = await generateInvoicePDF(invoiceData);
} catch (error) {
  if (validation.errors.length > 0) {
    // Handle validation errors
    const errors = validation.errors;
    // { field: "financial.netAmount", message: "..." }
  }
}
```

**Common Validation Errors:**
- "Invalid GSTIN format" - Expected format: 24AAWFP7490F1ZN
- "Invalid IFSC code format" - Expected: 4 letters + 0 + 6 alphanumeric
- "Invoice date must be in DD/MM/YYYY format"
- "Net amount does not match items total"

---

## 🌐 API Integration

### POST /api/invoices/generate-pdf

**Request:**
```bash
curl -X POST http://localhost:3000/api/invoices/generate-pdf \
  -H "Content-Type: application/json" \
  -d '{ "company": {...}, "customer": {...}, ... }'
```

**Response (Success):**
- Content-Type: application/pdf
- Body: PDF binary

**Response (Error):**
```json
{
  "success": false,
  "errors": [
    { "field": "company.name", "message": "Company name is required" }
  ]
}
```

---

## 🎨 Styling Details

### Font
- Default: Arial, sans-serif
- Sizes: 9pt (body), 10pt (headers), 8pt (labels)

### Colors
- Header Grey: #f3f4f6
- Border: #d1d5db
- Text: #333
- Amount: Green (#0a7e46) for owner share

### Spacing
- Page margins: 10mm
- Table padding: 8-10px
- Line height: 1.4-1.6

### Table Styling
- Header: Light grey background (#f3f4f6)
- Borders: Light grey (#d1d5db, 1px solid)
- Totals row: Bold, emphasized background

---

## 🔄 Batch Processing

Generate multiple invoices:

```typescript
import { generateInvoicesPDF } from '@/lib/invoice';

const invoices = [invoiceData1, invoiceData2, invoiceData3];
const pdfMap = await generateInvoicesPDF(invoices, './public/invoices');

// pdfMap is Map<invoiceNo, pdfBuffer>
for (const [invoiceNo, buffer] of pdfMap) {
  console.log(`Generated: ${invoiceNo}`);
}
```

---

## 🧹 Resource Cleanup

Puppeteer browser instance is managed automatically but can be explicitly closed:

```typescript
import { closeBrowser } from '@/lib/invoice';

// ... generate invoices ...

// Close browser to free resources
await closeBrowser();
```

---

## 📝 Notes & Best Practices

1. **Validation First**: Always validate invoice data before generating PDFs
2. **Error Handling**: Use try-catch blocks and handle validation errors gracefully
3. **Performance**: Use batch operations for multiple invoices
4. **Rounding**: Use `roundToNearestRupee()` for accurate financial math
5. **Dates**: Always use DD/MM/YYYY format for invoiceDate
6. **GSTIN**: Ensure GSTIN format is exactly correct (24 chars)
7. **Resource Management**: Close browser after batch operations

---

## 🆘 Troubleshooting

**Issue: "Cannot find module '@playwright/test'"**
- Not related to this invoice generator
- Remove or configure playwright.config.ts separately

**Issue: "Invalid GSTIN format"**
- Ensure format is: 2 digits + 5 uppercase letters + 4 digits + 1 uppercase letter + 1-9/A-Z + Z + 1 alphanumeric
- Example: 24AAWFP7490F1ZN

**Issue: "Net amount does not match items total"**
- Ensure: `financial.netAmount === basicTotal + roundOff`
- Round off should equal `Math.round(itemsSum) - itemsSum`

**Issue: PDF generation hangs**
- Ensure no other processes are using port that Puppeteer needs
- Check system resources (RAM, disk space)

---

## 📚 Integration Examples

### With Revenue Distribution Page

```typescript
import { getRevenueDistribution } from '@/app/actions/revenue';
import { generateInvoicePDF } from '@/lib/invoice';

const revenueData = await getRevenueDistribution(2, 2026);
const invoiceData = transformRevenueToInvoice(revenueData);
const pdf = await generateInvoicePDF(invoiceData);
```

### With Invoice Management Feature

```typescript
// In invoice detail page
export default function InvoiceDetail({ invoiceId }) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);

  return (
    <div>
      <h1>{invoice?.metadata.invoiceNo}</h1>
      <InvoicePDFExporter invoiceData={invoice} />
    </div>
  );
}
```

---

## 📞 Support & Maintenance

- **Dependencies**: Puppeteer (HTML-to-PDF)
- **Updates**: Check Puppeteer releases for compatibility
- **Performance**: Averages 2-3 seconds per PDF generation
- **Output**: A4 (210mm x 297mm) PDF with 10mm margins

---

Generated: April 2026
WMS Pro v1.0
