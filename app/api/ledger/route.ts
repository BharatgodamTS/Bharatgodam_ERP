import { NextRequest, NextResponse } from 'next/server';
import { getClientLedger } from '@/app/actions/transaction-actions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    const ledgerData = await getClientLedger(clientId);
    return NextResponse.json(ledgerData);
  } catch (error) {
    console.error('Ledger API error:', error);
    return NextResponse.json({ error: 'Failed to fetch ledger data' }, { status: 500 });
  }
}