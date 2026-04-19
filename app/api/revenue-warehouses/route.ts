import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();
    const warehouses = await db.collection('warehouses').find({}).sort({ name: 1 }).toArray();

    return NextResponse.json(warehouses);

  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch warehouses' },
      { status: 500 }
    );
  }
}