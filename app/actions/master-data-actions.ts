'use server';

import { getDb } from '@/lib/mongodb';
import type { IClient, ICommodity, IWarehouse } from '@/types/schemas';

export async function getMasterData() {
  const db = await getDb();

  const [clients, commodities, warehouses] = await Promise.all([
    db.collection('clients').find({ status: 'ACTIVE' }).toArray(),
    db.collection('commodities').find({}).toArray(),
    db.collection('warehouses').find({ status: 'ACTIVE' }).toArray(),
  ]);

  return {
    clients: clients as IClient[],
    commodities: commodities as ICommodity[],
    warehouses: warehouses as IWarehouse[],
  };
}