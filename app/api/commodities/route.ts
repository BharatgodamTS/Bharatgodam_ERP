import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const db = await getDb();

    // Get commodities from warehouse_config
    const config = await db.collection('warehouse_config').findOne({});
    const commodities = config?.commodities || [
      { id: 'comm1', name: 'Rice Paddy', rate: 10, rateUnit: 'day' },
      { id: 'comm2', name: 'Wheat', rate: 8, rateUnit: 'day' },
      { id: 'comm3', name: 'Corn', rate: 12, rateUnit: 'day' },
    ];

    return NextResponse.json({
      success: true,
      commodities
    });

  } catch (error) {
    console.error('Error fetching commodities:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch commodities' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, rate, rateUnit } = body;

    if (!name || !rate || !rateUnit) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: name, rate, rateUnit'
      }, { status: 400 });
    }

    const db = await getDb();

    const commodity = {
      name,
      rate: Number(rate),
      rateUnit,
      userId: (session.user as any).id,
      userEmail: session.user.email,
      createdAt: new Date(),
    };

    const result = await db.collection('commodities').insertOne(commodity);

    return NextResponse.json({
      success: true,
      message: 'Commodity created successfully',
      commodity: {
        id: result.insertedId.toString(),
        ...commodity
      }
    });

  } catch (error) {
    console.error('Error creating commodity:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create commodity' },
      { status: 500 }
    );
  }
}