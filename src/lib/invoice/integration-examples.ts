/**
 * Invoice Generation Integration Examples
 * Real-world usage patterns for the invoice generator
 */

import { InvoiceData, generateInvoicePDF, sampleInvoiceData } from '@/lib/invoice';

// ============================================================================
// Example 1: Generate Invoice from Warehouse Revenue Data
// ============================================================================

/**
 * Transform revenue distribution data into invoice format
 * Useful for creating invoices from the revenue distribution page
 */
export async function generateInvoiceFromRevenue(revenueData: any): Promise<Buffer> {
  // Transform revenue data to invoice format
  const invoiceData: InvoiceData = {
    company: {
      name: 'WMS PRO WAREHOUSE MANAGEMENT',
      address: '123 Warehouse Complex, Industrial Area, Mumbai - 400088',
      email: 'billing@wmspro.com',
      website: 'www.wmspro.com',
      phone: '+91-22-4040-4040',
      gstin: '24AAWFP7490F1ZN',
    },
    customer: {
      name: revenueData.ownerName || 'Owner',
      area: revenueData.warehouseName || 'Warehouse',
      city: 'Mumbai',
      district: 'Mumbai',
      state: 'Maharashtra',
    },
    metadata: {
      invoiceNo: `INV-${Date.now()}`,
      invoiceDate: new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    },
    lineItems: revenueData.services.map((service: any, idx: number) => ({
      whCode: `WH${idx + 1}`,
      billFrom: 'WMS PRO',
      itemName: service.name,
      corNo: `COR-${idx + 1}`,
      billTo: revenueData.ownerName,
      quantity: 1,
      weight: 0,
      month: new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      days: 30,
      ratePerUnit: service.rate,
      storageChargesPerMonth: service.rate,
      amount: service.rate,
    })),
    financial: {
      basicTotal: revenueData.total,
      roundOff: 0,
      netAmount: revenueData.total,
    },
    bankDetails: {
      bankName: 'HDFC Bank',
      branchName: 'Mumbai Branch',
      accountNumber: '1234567890123456',
      ifscCode: 'HDFC0000123',
    },
    termsAndConditions: [
      {
        title: 'Payment Terms',
        description: 'Payment is due within 15 days of invoice date.',
      },
      {
        title: 'Late Payment',
        description: 'Late payments attract 18% p.a. interest.',
      },
      {
        title: 'Dispute Resolution',
        description: 'All disputes shall be resolved in Mumbai courts.',
      },
    ],
    authorizedBy: 'Finance Department',
  };

  return generateInvoicePDF(invoiceData);
}

// ============================================================================
// Example 2: Generate Invoice with Dynamic Calculations
// ============================================================================

/**
 * Generate invoice with automatic calculations
 * Handles rounding and amount-in-words conversion
 */
export async function generateInvoiceWithCalculations(
  rawInvoiceData: Partial<InvoiceData>
): Promise<Buffer> {
  const { formatCurrency, roundToNearestRupee } = await import('@/lib/invoice');

  // Calculate totals
  const basicTotal = rawInvoiceData.lineItems?.reduce((sum, item) => sum + item.amount, 0) || 0;
  const { rounded, roundOff } = roundToNearestRupee(basicTotal);

  const completeInvoiceData: InvoiceData = {
    ...sampleInvoiceData,
    ...rawInvoiceData,
    financial: {
      basicTotal,
      roundOff,
      netAmount: rounded,
    },
  };

  return generateInvoicePDF(completeInvoiceData);
}

// ============================================================================
// Example 3: Batch Invoice Generation for Multiple Customers
// ============================================================================

/**
 * Generate invoices for multiple warehouses and save them
 */
export async function generateBatchInvoices(
  customerList: Array<{
    name: string;
    warehouse: string;
    amount: number;
    invoiceNumber: string;
  }>
): Promise<Map<string, Buffer>> {
  const { generateInvoicesPDF } = await import('@/lib/invoice');

  const invoices = customerList.map((customer) => ({
    ...sampleInvoiceData,
    customer: {
      ...sampleInvoiceData.customer,
      name: customer.name,
      area: customer.warehouse,
    },
    metadata: {
      invoiceNo: customer.invoiceNumber,
      invoiceDate: new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    },
    lineItems: [
      {
        ...sampleInvoiceData.lineItems[0],
        itemName: `Storage at ${customer.warehouse}`,
        amount: customer.amount,
      },
    ],
    financial: {
      basicTotal: customer.amount,
      roundOff: 0,
      netAmount: customer.amount,
    },
  }));

  return generateInvoicesPDF(invoices, './public/invoices');
}

// ============================================================================
// Example 4: Invoice Generation with Email Integration
// ============================================================================

/**
 * Generate invoice and prepare for email
 * Returns both PDF and email metadata
 */
export async function generateAndPrepareForEmail(
  invoiceData: InvoiceData
): Promise<{
  pdf: Buffer;
  fileName: string;
  emailSubject: string;
  emailBody: string;
}> {
  const pdf = await generateInvoicePDF(invoiceData);

  const fileName = `${invoiceData.metadata.invoiceNo.replace(/\//g, '-')}.pdf`;
  const emailSubject = `Invoice ${invoiceData.metadata.invoiceNo} from ${invoiceData.company.name}`;

  const emailBody = `
Dear ${invoiceData.customer.name},

Please find attached invoice ${invoiceData.metadata.invoiceNo} for services rendered.

Invoice Details:
- Invoice Number: ${invoiceData.metadata.invoiceNo}
- Invoice Date: ${invoiceData.metadata.invoiceDate}
- Amount: ₹${invoiceData.financial.netAmount.toFixed(2)}

Please arrange payment as per the terms mentioned in the invoice.

For any queries, please contact us at:
${invoiceData.company.email} | ${invoiceData.company.phone}

Thank you for your business!

Best regards,
${invoiceData.company.name}
  `.trim();

  return {
    pdf,
    fileName,
    emailSubject,
    emailBody,
  };
}

// ============================================================================
// Example 5: Invoice Validation Before Generation
// ============================================================================

/**
 * Comprehensive validation with detailed error reporting
 */
export async function validateAndGenerateInvoice(
  invoiceData: InvoiceData
): Promise<{
  success: boolean;
  pdf?: Buffer;
  errors?: Array<{ field: string; message: string }>;
  warnings?: string[];
}> {
  const { InvoiceValidator } = await import('@/lib/invoice');

  const validator = new InvoiceValidator();
  const validation = validator.validate(invoiceData);

  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  // Additional business logic validation
  const warnings: string[] = [];

  if (invoiceData.financial.roundOff > 1) {
    warnings.push('Round-off amount is unusually high');
  }

  if (invoiceData.lineItems.length > 50) {
    warnings.push('Invoice has more than 50 line items');
  }

  const oldDate = new Date(invoiceData.metadata.invoiceDate);
  if (Date.now() - oldDate.getTime() > 30 * 24 * 60 * 60 * 1000) {
    warnings.push('Invoice is older than 30 days');
  }

  try {
    const pdf = await generateInvoicePDF(invoiceData);

    return {
      success: true,
      pdf,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      success: false,
      errors: [{ field: 'pdf_generation', message: error instanceof Error ? error.message : 'Unknown error' }],
    };
  }
}

// ============================================================================
// Example 6: Create Test/Sample Invoices
// ============================================================================

/**
 * Generate sample invoices for testing
 */
export async function generateSampleInvoices(): Promise<void> {
  const { generateInvoicesPDF, sampleInvoiceData, sampleInvoiceData2 } = await import('@/lib/invoice');

  const samples = [sampleInvoiceData, sampleInvoiceData2];

  console.log('Generating sample invoices...');
  const results = await generateInvoicesPDF(samples, './downloads');

  for (const [invoiceNo, pdf] of results) {
    console.log(`✓ Generated: ${invoiceNo} (${pdf.length} bytes)`);
  }
}

// ============================================================================
// Example 7: Invoice Tracking & Status Management
// ============================================================================

/**
 * Simple invoice tracking system
 */
export class InvoiceTracker {
  private invoices: Map<string, { data: InvoiceData; generatedAt: Date; status: 'pending' | 'generated' | 'sent' | 'paid' }> = new Map();

  async generateAndTrack(invoiceData: InvoiceData): Promise<{ id: string; pdf: Buffer }> {
    const id = invoiceData.metadata.invoiceNo;

    const pdf = await generateInvoicePDF(invoiceData);

    this.invoices.set(id, {
      data: invoiceData,
      generatedAt: new Date(),
      status: 'generated',
    });

    return { id, pdf };
  }

  markAsSent(invoiceId: string): void {
    const invoice = this.invoices.get(invoiceId);
    if (invoice) {
      invoice.status = 'sent';
    }
  }

  markAsPaid(invoiceId: string): void {
    const invoice = this.invoices.get(invoiceId);
    if (invoice) {
      invoice.status = 'paid';
    }
  }

  getStatus(invoiceId: string): string | undefined {
    return this.invoices.get(invoiceId)?.status;
  }

  listAll(): Array<{ id: string; amount: number; status: string; date: string }> {
    const list: Array<{ id: string; amount: number; status: string; date: string }> = [];

    for (const [id, invoice] of this.invoices) {
      list.push({
        id,
        amount: invoice.data.financial.netAmount,
        status: invoice.status,
        date: invoice.data.metadata.invoiceDate,
      });
    }

    return list;
  }
}

// ============================================================================
// Example Usage
// ============================================================================

/**
 * Usage examples can be run in Next.js Server Actions or API Routes:
 *
 * // In Server Action
 * export async function generateWarehouseInvoice(warehouseId: string) {
 *   const customer = await getWarehouseData(warehouseId);
 *   const pdf = await generateInvoiceWithCalculations(customer);
 *   return pdf;
 * }
 *
 * // In API Route
 * export async function POST(req: NextRequest) {
 *   const invoiceData = await req.json();
 *   const result = await validateAndGenerateInvoice(invoiceData);
 *   if (!result.success) {
 *     return NextResponse.json({ errors: result.errors }, { status: 400 });
 *   }
 *   return new NextResponse(result.pdf, {
 *     headers: { 'Content-Type': 'application/pdf' }
 *   });
 * }
 *
 * // Client-side Usage
 * const tracker = new InvoiceTracker();
 * const { pdf } = await tracker.generateAndTrack(invoiceData);
 * tracker.markAsSent(invoiceData.metadata.invoiceNo);
 */
