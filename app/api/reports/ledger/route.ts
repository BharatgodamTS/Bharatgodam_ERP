import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { appendOwnership, requireSession } from '@/lib/ownership';
import { ObjectId } from 'mongodb';

/**
 * POST /api/reports/ledger
 * Record a payment for a client
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();

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
    const idToUse = accountId || body.clientId;
    let clientObjectId: ObjectId | null = null;
    try {
      if (idToUse) clientObjectId = new ObjectId(String(idToUse).trim());
    } catch (e) {
      console.warn('Invalid clientId for ObjectId conversion:', idToUse);
    }

    const paymentDocument = appendOwnership({
      accountId: idToUse?.trim() || null,
      clientId: clientObjectId,
      clientName: clientName?.trim() || '',
      amount: Number(amount),
      date: new Date(date).toISOString().split('T')[0],
      paymentDate: new Date(date), // Add paymentDate for consistency with recordPayment action
      invoiceId: body.invoiceId ? (() => { try { return new ObjectId(body.invoiceId); } catch { return body.invoiceId; } })() : null,
      recordedBy: session.user?.email,
      createdAt: new Date(),
      status: 'COMPLETED',
    }, session);

    const result = await db.collection('payments').insertOne(paymentDocument);

    // Update invoice_master if invoiceId provided
    if (body.invoiceId) {
      try {
        const invId = new ObjectId(body.invoiceId);
        const master = await db.collection('invoice_master').findOne({ _id: invId });
        if (master) {
          const newPaid = (master.paidAmount || 0) + Number(amount);
          const newStatus = newPaid >= (master.totalAmount || 0) ? 'PAID' : 'PARTIAL';
          await db.collection('invoice_master').updateOne(
            { _id: invId },
            { $set: { paidAmount: newPaid, status: newStatus, updatedAt: new Date() } }
          );
        }
      } catch (err) {
        console.warn('Could not update invoice_master:', err);
      }
    }

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
