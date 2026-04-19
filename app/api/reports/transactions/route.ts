import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const direction = searchParams.get('direction');
    const clientId = searchParams.get('clientId');
    const commodityId = searchParams.get('commodityId');
    const warehouseId = searchParams.get('warehouseId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const db = await getDb();

    const filter: any = {};
    if (direction) filter.direction = { $in: direction.split(',') };
    if (clientId) filter.clientId = clientId;
    if (commodityId) filter.commodityId = commodityId;
    if (warehouseId) filter.warehouseId = warehouseId;

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const inwardsCollection = db.collection('inwards');
    const outwardsCollection = db.collection('outwards');

    const [inwardTransactions, outwardTransactions] = await Promise.all([
      inwardsCollection
        .find(direction !== 'OUTWARD' ? filter : { $expr: { $literal: false } })
        .toArray(),
      outwardsCollection
        .find(direction !== 'INWARD' ? filter : { $expr: { $literal: false } })
        .toArray(),
    ]);

    const transactions = [
      ...inwardTransactions.map((t: any) => ({
        ...t,
        direction: 'INWARD',
        date: t.date || t.createdAt,
      })),
      ...outwardTransactions.map((t: any) => ({
        ...t,
        direction: 'OUTWARD',
        date: t.date || t.createdAt,
      })),
    ].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      success: true,
      data: transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
