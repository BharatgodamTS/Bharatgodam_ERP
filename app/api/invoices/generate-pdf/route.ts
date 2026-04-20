/**
 * Invoice PDF Generation API Route
 * POST /api/invoices/generate-pdf
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateInvoicePDF, closeBrowser, InvoiceValidator } from '@/lib/invoice';
import { InvoiceData } from '@/lib/invoice/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const invoiceData: InvoiceData = body.invoiceData || body;
    const summary = body.summary === true;

    // Validate invoice data
    const validator = new InvoiceValidator();
    const validation = validator.validate(invoiceData);

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Generate PDF (summary or detailed)
    const pdfBuffer = await generateInvoicePDF(invoiceData, undefined, summary);

    // Return PDF as response
    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoiceData.metadata.invoiceNo.replace(/\//g, '_')}.pdf"`,
        'Cache-Control': 'no-cache, no-store',
      },
    });
  } catch (error) {
    console.error('Invoice generation error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate invoice',
      },
      { status: 500 }
    );
  } finally {
    // Clean up browser resources
    await closeBrowser();
  }
}
