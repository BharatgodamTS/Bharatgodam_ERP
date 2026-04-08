'use server';

import { getDb } from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { CommodityValues, MongoCommodity } from '@/lib/validations/commodity';

export async function fetchCommodities(): Promise<MongoCommodity[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Unauthorized Setup Access');

  const db = await getDb();
  const items = await db.collection('commodities').find().sort({ name: 1 }).toArray();

  return items.map(item => ({
    _id: item._id.toString(),
    name: item.name,
    baseRate: item.baseRate,
    unit: item.unit || 'MT',
    category: item.category,
    updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
  }));
}

export async function addCommodity(data: CommodityValues) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, message: 'Authentication required' };

  try {
    const db = await getDb();
    
    // Safety 1: Duplicate Block
    const existing = await db.collection('commodities').findOne({ name: data.name });
    if (existing) {
      return { success: false, message: `A Commodity named ${data.name} already exists.` };
    }

    // Safety 2: Floating point rounding (2 Decimals max)
    const secureRate = Math.round(data.baseRate * 100) / 100;

    const payload = {
      name: data.name,
      baseRate: secureRate,
      unit: data.unit || 'MT',
      category: data.category,
      updatedAt: new Date(),
      createdAt: new Date(),
      createdBy: session.user.email,
    };

    await db.collection('commodities').insertOne(payload);
    revalidatePath('/dashboard/commodities');
    
    return { success: true };
  } catch (error: any) {
    console.error('Commodity Insert Crash:', error);
    return { success: false, message: 'Internal Engine DB Failure.' };
  }
}

export async function updateCommodity(id: string, data: CommodityValues) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, message: 'Authentication required' };

  try {
    const db = await getDb();
    const objectId = new ObjectId(id);
    
    // Safety 1: Duplicate Block (excluding the current document)
    const existing = await db.collection('commodities').findOne({ 
      name: data.name,
      _id: { $ne: objectId } 
    });
    if (existing) {
      return { success: false, message: `Another commodity named ${data.name} already exists.` };
    }

    const secureRate = Math.round(data.baseRate * 100) / 100;

    await db.collection('commodities').updateOne(
      { _id: objectId },
      { 
        $set: {
          name: data.name,
          baseRate: secureRate,
          unit: data.unit,
          category: data.category,
          updatedAt: new Date(),
          updatedBy: session.user.email,
        }
      }
    );

    revalidatePath('/dashboard/commodities');
    return { success: true };
  } catch (error: any) {
    console.error('Commodity Update Crash:', error);
    return { success: false, message: 'Internal Mongo Update Failure.' };
  }
}

export async function deleteCommodity(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, message: 'Authentication required' };

  try {
    const db = await getDb();
    await db.collection('commodities').deleteOne({ _id: new ObjectId(id) });
    
    revalidatePath('/dashboard/commodities');
    return { success: true };
  } catch (error) {
    return { success: false, message: 'Database deletion failure' };
  }
}
