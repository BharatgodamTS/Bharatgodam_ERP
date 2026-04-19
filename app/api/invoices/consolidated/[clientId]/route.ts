import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUnifiedFinancials } from '@/app/actions/invoices';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { clientId } = await params;
    if (!clientId) {
      return NextResponse.json({ success: false, message: 'Client ID is required' }, { status: 400 });
    }

    const unified = await getUnifiedFinancials(clientId);
    if (!unified.success || !unified.data) {
      return NextResponse.json(
        { success: false, message: unified.message || 'Unified invoice data not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: unified.data }, { status: 200 });
  } catch (error: any) {
    console.error('GET /api/invoices/consolidated/[clientId] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
