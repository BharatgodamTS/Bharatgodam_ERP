'use server';

import connectToDatabase from '@/lib/mongoose';
import Warehouse from '@/lib/models/Warehouse';
import { revalidatePath } from 'next/cache';

export async function getWarehouses() {
  await connectToDatabase();
  const warehouses = await Warehouse.find({ status: 'ACTIVE' }).sort({ name: 1 });
  return JSON.parse(JSON.stringify(warehouses));
}

export async function createWarehouse(data: {
  name: string;
  address: string;
  totalCapacity: number;
}) {
  await connectToDatabase();
  try {
    const warehouse = await Warehouse.create({
      ...data,
      occupiedCapacity: 0,
      status: 'ACTIVE',
    });
    revalidatePath('/dashboard/warehouses');
    return { success: true, data: JSON.parse(JSON.stringify(warehouse)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateWarehouse(id: string, data: Partial<{
  name: string;
  address: string;
  totalCapacity: number;
  status: string;
}>) {
  await connectToDatabase();
  try {
    const warehouse = await Warehouse.findByIdAndUpdate(id, data, { new: true });
    revalidatePath('/dashboard/warehouses');
    return { success: true, data: JSON.parse(JSON.stringify(warehouse)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
