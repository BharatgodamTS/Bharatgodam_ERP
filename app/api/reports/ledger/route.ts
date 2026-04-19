import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/reports/ledger
 * Record a payment for a client
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { accountId, clientName, amount, date } = body;

    if ((!accountId || !String(accountId).trim()) && (!clientName || !String(clientName).trim())) {
      return NextResponse.json(
        { success: false, message: 'accountId or clientName is required' },
        { status: 400 }
      );
    }

    if (!amount || !date) {
      return NextResponse.json(
        { success: false, message: 'amount and date are required' },
        { status: 400 }
      );
    }

    const db = await getDb();

    const result = await db.collection('payments').insertOne({
      accountId: accountId?.trim() || null,
      clientName: clientName?.trim() || '',
      amount: Number(amount),
      date: new Date(date).toISOString().split('T')[0],
      recordedBy: session.user?.email,
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        success: true,
        paymentId: result.insertedId.toString(),
        message: 'Payment recorded successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/reports/ledger error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
