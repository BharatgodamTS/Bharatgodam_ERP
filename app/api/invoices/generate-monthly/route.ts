import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateMonthlyInvoices } from '@/app/actions/stock-ledger-actions';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const invoiceMonth = String(body.invoiceMonth || '').trim();

    if (!invoiceMonth) {
      return NextResponse.json({ success: false, message: 'invoiceMonth is required' }, { status: 400 });
    }

    const result = await generateMonthlyInvoices(invoiceMonth);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    console.error('POST /api/invoices/generate-monthly error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to generate invoices' },
      { status: 500 }
    );
  }
}
