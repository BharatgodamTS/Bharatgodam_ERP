'use server';

import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongoose';
import Client from '@/lib/models/Client';
import { revalidatePath } from 'next/cache';

type LegacyClient = {
  _id: string;
  clientName?: string;
  name?: string;
  clientLocation?: string;
  address?: string;
  clientType?: string;
  contactInfo?: {
    mobile?: string;
    phone?: string;
  };
};

export async function getClients() {
  await connectToDatabase();
  const clients = await Client.find({}).sort({ name: 1 });

  if (!clients.length) {
    if (!mongoose.connection.db) {
      throw new Error('Database connection not established');
    }
    
    const rawClients = await mongoose.connection.db
      .collection('client_accounts')
      .find({})
      .sort({ clientName: 1 })
      .toArray();

    const legacyClients = rawClients.map((client: any) => ({
      _id: client._id.toString(),
      name: client.clientName || client.name || 'Unknown',
      address: client.clientLocation || client.address || '',
      clientType: client.clientType || 'FARMER',
      mobile: client.contactInfo?.mobile || client.contactInfo?.phone || ''
    }));

    return JSON.parse(JSON.stringify(legacyClients));
  }

  return JSON.parse(JSON.stringify(clients));
}

export async function createClient(data: {
  name: string;
  address: string;
  clientType: 'FARMER' | 'FPO' | 'COMPANY';
  mobile: string;
}) {
  await connectToDatabase();
  try {
    const client = await Client.create(data);
    revalidatePath('/dashboard/clients');
    return { success: true, data: JSON.parse(JSON.stringify(client)) };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function updateClient(id: string, data: Partial<{
  name: string;
  address: string;
  clientType: string;
  mobile: string;
}>) {
  await connectToDatabase();
  try {
    const client = await Client.findByIdAndUpdate(id, data, { new: true });
    revalidatePath('/dashboard/clients');
    return { success: true, data: JSON.parse(JSON.stringify(client)) };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
