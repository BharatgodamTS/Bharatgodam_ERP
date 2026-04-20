import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getInvoiceData } from '@/app/actions/invoices-pdf';
import { generateInvoicePDF } from '@/lib/invoice';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get invoice data from database
    const invoiceData = await getInvoiceData(id);

    if (!invoiceData) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Generate PDF (summary format)
    const pdfBuffer = await generateInvoicePDF(invoiceData, undefined, true);

    // Return PDF as response
    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoiceData.metadata.invoiceNo.replace(/\//g, '_')}.pdf"`,
        'Cache-Control': 'no-cache, no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate invoice';
    console.error('Invoice download error:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
