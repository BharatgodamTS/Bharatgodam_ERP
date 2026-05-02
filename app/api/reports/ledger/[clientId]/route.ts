import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantFilterForMongo } from '@/lib/ownership';
import { calculateLedger } from '@/lib/ledger-engine';
import { ObjectId } from 'mongodb';
import type { Transaction, Payment, MatchedRecord } from '@/lib/ledger-engine';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const tenantFilter = getTenantFilterForMongo(session);

    const { clientId } = await params;
    if (!clientId) {
      return NextResponse.json({ success: false, message: 'Client ID is required' }, { status: 400 });
    }
    const trimmedClientId = clientId.trim();
    if (!trimmedClientId) {
      return NextResponse.json({ success: false, message: 'Client ID is required' }, { status: 400 });
    }

    const db = await getDb();

    // Fetch client to get their name (used as fallback filter for legacy records)
    const client = await db.collection('clients').findOne({ 
      $or: [{ _id: new ObjectId(trimmedClientId) }, { _id: trimmedClientId as any }],
      ...tenantFilter 
    });

    const clientName = client?.name || client?.clientName || '';
    const accountId = trimmedClientId;

    // Create a robust filter that matches by ID or Name
    const clientMatch: any = {
      $or: [
        { accountId: trimmedClientId },
        { clientId: trimmedClientId },
        { clientId: new ObjectId(trimmedClientId) }
      ]
    };

    // If we have a client name, also match by name for legacy records that might be missing IDs
    if (clientName) {
      clientMatch.$or.push({ clientName: clientName });
      // Some legacy systems might use different casing or field names
      clientMatch.$or.push({ clientName: clientName.toUpperCase() });
    }

    const [bookings, transactionDocs, paymentsDocs, outstandingInvoicesResult, commoditiesResult] = await Promise.all([
      db.collection('bookings')
        .find({ 
          ...clientMatch,
          direction: { $in: ['INWARD', 'OUTWARD'] }, 
          ...tenantFilter 
        })
        .sort({ date: 1 })
        .toArray(),
      db.collection('transactions')
        .find({ 
          ...clientMatch,
          ...tenantFilter 
        })
        .sort({ date: 1 })
        .toArray(),
      db.collection('payments')
        .find({ 
          ...clientMatch,
          ...tenantFilter 
        })
        .sort({ date: 1, paymentDate: 1 })
        .toArray(),
      db.collection('invoice_master')
        .aggregate([
          { $match: { clientId: new ObjectId(trimmedClientId), status: { $ne: 'PAID' }, ...tenantFilter } },
          { $group: { _id: null, totalOutstanding: { $sum: '$totalAmount' } } }
        ])
        .toArray(),
      db.collection('commodities')
        .find({ ...tenantFilter })
        .toArray(),
    ]);

    // Create a map of commodity name -> rate per day per MT
    const normalizeCommodityName = (value: string | undefined | null) =>
      typeof value === 'string' ? value.trim().toUpperCase() : '';

    const commodityRates = new Map<string, number>();
    commoditiesResult.forEach((commodity: any) => {
      const nameKey = normalizeCommodityName(commodity.name);
      const rate =
        Number(commodity.ratePerMtPerDay ?? commodity.ratePerDayPerMT ?? commodity.ratePerMTPerDay ?? commodity.ratePerMTPerDay ?? 0);

      if (nameKey && rate > 0) {
        commodityRates.set(nameKey, rate);
        console.log(`[LEDGER] Loaded commodity rate: '${nameKey}' -> ₹${rate}/MT/day`);
      }
    });

    const transactionData: Transaction[] = Array.from(
      new Map(
        [
          ...bookings.map((txn) => ({
            _id: txn._id?.toString() || '',
            date: txn.date || txn.createdAt,
            direction: txn.direction,
            mt: txn.mt,
            clientName: txn.clientName,
            commodityName: txn.commodityName,
            gatePass: txn.gatePass,
          })),
          ...transactionDocs.map((txn) => ({
            _id: txn._id?.toString() || '',
            date: txn.date || txn.createdAt,
            direction: txn.direction,
            mt: txn.quantityMT || txn.mt,
            clientName: txn.clientName || bookings[0]?.clientName || clientId,
            commodityName: txn.commodityName,
            gatePass: txn.gatePass || '',
          })),
        ].map((item) => [item._id, item])
      ).values()
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const paymentData: Payment[] = paymentsDocs.map((pay) => ({
      _id: pay._id?.toString() || '',
      date: pay.date || pay.paymentDate || pay.createdAt,
      amount: pay.amount,
      clientName: pay.clientName || bookings[0]?.clientName || clientId,
    }));

    // Calculate outstanding invoices
    const outstandingInvoices = outstandingInvoicesResult.length > 0 
      ? outstandingInvoicesResult[0].totalOutstanding || 0 
      : 0;

    const matchedRecords: MatchedRecord[] = bookings.map((booking) => ({
      _id: booking._id?.toString() || '',
      clientName: booking.clientName,
      date: booking.date,
      location: booking.location || '',
      commodity: booking.commodityName || '',
      totalMT: booking.direction === 'INWARD' ? booking.mt : -booking.mt,
    }));

    const ledgerSummary = calculateLedger(
      transactionData,
      paymentData,
      bookings[0]?.clientName || clientId,
      outstandingInvoices,
      commodityRates
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          ...ledgerSummary,
          transactions: transactionData,
          matchedRecords,
          recordCount: matchedRecords.length,
          isAggregated: matchedRecords.length > 1,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('GET /api/reports/ledger/[clientId] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
