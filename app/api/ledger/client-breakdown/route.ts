import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET() {
  const db = await getDb();

  try {
    // Get all active clients
    const clients = await db.collection('clients').find({ status: 'ACTIVE' }).toArray();

    let totalOutstanding = 0;
    let totalReceived = 0;

    const clientBreakdown = (await Promise.all(
      clients.map(async (client) => {
        const clientId = client._id;

        // Get outstanding invoices for this client (unpaid balance)
        const outstandingResult = await db.collection('invoice_master').aggregate([
          { $match: { clientId } },
          {
            $project: {
              totalAmount: 1,
              paidAmount: { $ifNull: ['$paidAmount', 0] },
              pendingAmount: {
                $max: [
                  { $subtract: ['$totalAmount', { $ifNull: ['$paidAmount', 0] }] },
                  0
                ]
              },
              status: 1
            }
          },
          { $match: { status: { $ne: 'PAID' }, pendingAmount: { $gt: 0 } } },
          { $group: { _id: null, totalOutstanding: { $sum: '$pendingAmount' } } }
        ]).toArray();

        const clientOutstanding = outstandingResult[0]?.totalOutstanding ?? 0;

        // Get received payments for this client
        const receivedResult = await db.collection('payments').aggregate([
          { $match: { clientId, status: 'COMPLETED' } },
          { $group: { _id: null, totalReceived: { $sum: '$amount' } } }
        ]).toArray();

        const clientReceived = receivedResult[0]?.totalReceived ?? 0;

        totalOutstanding += clientOutstanding;
        totalReceived += clientReceived;

        return {
          clientId: clientId.toString(),
          clientName: client.name,
          outstanding: Math.round(clientOutstanding * 100) / 100,
          received: Math.round(clientReceived * 100) / 100,
          balance: Math.round((clientOutstanding - clientReceived) * 100) / 100
        };
      })
    )).filter(item => item.outstanding > 0 || item.received > 0);

    // Sort by outstanding descending
    clientBreakdown.sort((a, b) => b.outstanding - a.outstanding);

    return NextResponse.json({
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalReceived: Math.round(totalReceived * 100) / 100,
      clientBreakdown
    });
  } catch (error: any) {
    console.error('Error fetching client breakdown:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
