'use server';

import connectToDatabase from '@/lib/mongoose';
import Commodity from '@/lib/models/Commodity';
import { revalidatePath } from 'next/cache';

export async function fetchCommodities() {
  await connectToDatabase();
  const items = await Commodity.find({}).sort({ name: 1 });
  return JSON.parse(JSON.stringify(items.map(item => ({
    _id: item._id,
    name: item.name,
    ratePerMtPerDay: item.ratePerMtPerDay,
    updatedAt: item.updatedAt,
    createdAt: item.createdAt,
  }))));
}

export async function addCommodity(data: { name: string; ratePerMtPerDay: number }) {
  await connectToDatabase();
  try {
    const item = await Commodity.create(data);
    revalidatePath('/dashboard/commodities');
    return { success: true, data: JSON.parse(JSON.stringify(item)) };
  } catch (error: any) {
    if (error.code === 11000) {
      return { success: false, error: 'Commodity name must be unique' };
    }
    return { success: false, error: error.message };
  }
}

export async function updateCommodity(id: string, data: { name: string; ratePerMtPerDay: number }) {
  await connectToDatabase();
  try {
    const item = await Commodity.findByIdAndUpdate(id, data, { new: true });
    revalidatePath('/dashboard/commodities');
    return { success: true, data: JSON.parse(JSON.stringify(item)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteCommodity(id: string) {
  await connectToDatabase();
  try {
    await Commodity.findByIdAndDelete(id);
    revalidatePath('/dashboard/commodities');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
