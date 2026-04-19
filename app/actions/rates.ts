'use server';

import { getDb } from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { RateMasterValues, MongoCommodityRate } from '@/lib/validations/rate-master';

// FETCH: Retrieves and purges naturally expired dates asynchronously!
export async function fetchRates(): Promise<MongoCommodityRate[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Unauthorized Profile Access');

  const db = await getDb();
  const rates = await db.collection('commodity_rates').find().sort({ createdAt: -1 }).toArray();
  const now = new Date();
  
  let needsRevalidate = false;

  // Evaluate every row on-the-fly. If time > endDate, update Mongo instantly.
  const validRates = await Promise.all(rates.map(async (rate) => {
    let currentStatus = rate.status || 'Active';
    const parsedEnd = new Date(rate.endDate);
    
    // Automatically transition to Expired if 1ms past Midnight of the End Date
    if (currentStatus === 'Active' && now > parsedEnd) {
      await db.collection('commodity_rates').updateOne(
        { _id: rate._id },
        { $set: { status: 'Expired' } }
      );
      currentStatus = 'Expired';
      needsRevalidate = true;
    }

    return {
      _id: rate._id.toString(), // Strip ObjectID buffer crash
      name: rate.name,
      ratePerMT: rate.ratePerMT,
      startDate: new Date(rate.startDate).toISOString(),
      endDate: parsedEnd.toISOString(),
      notes: rate.notes || '',
      status: currentStatus,
      createdAt: rate.createdAt ? new Date(rate.createdAt).toISOString() : new Date().toISOString(),
    };
  }));

  // Force Next.js to dump cache if the Auto-Expirer triggered an update
  if (needsRevalidate) {
    revalidatePath('/dashboard/rates');
  }

  return validRates;
}

// POST: Safely locks in seasonal price curves
export async function createRate(data: RateMasterValues) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, message: 'Authentication required' };

  try {
    const db = await getDb();
    
    // Security: Truncate decimals to physically prevent weird JS trailing decimals injected via client
    const safeRate = Math.round(data.ratePerMT * 100) / 100;

    const newRate = {
      name: data.name,
      ratePerMT: safeRate,
      startDate: new Date(data.startDate), // Lock as native Mongo Date
      endDate: new Date(data.endDate),
      notes: data.notes,
      status: 'Active', 
      createdBy: session.user.email,
      createdAt: new Date(),
    };

    await db.collection('commodity_rates').insertOne(newRate);
    revalidatePath('/dashboard/rates');
    
    return { success: true };
  } catch (error: any) {
    console.error('Rate Creation DB Error:', error);
    return { success: false, message: 'Exception saving Seasonal Data to cluster.' };
  }
}

// DELETE: Obliterate a bad Configuration string
export async function deleteRate(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, message: 'Restricted Action' };

  try {
    const db = await getDb();
    await db.collection('commodity_rates').deleteOne({ _id: new ObjectId(id) });
    
    revalidatePath('/dashboard/rates');
    return { success: true };
  } catch (error) {
    return { success: false, message: 'Database deletion failure' };
  }
}
