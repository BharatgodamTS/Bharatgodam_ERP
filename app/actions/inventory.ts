'use server';

import { getDb } from '@/lib/mongodb';
import { InventoryItem } from '@/types/mongodb';
import { ObjectId } from 'mongodb';

export async function getWarehouseInventory(warehouseId: string): Promise<InventoryItem[]> {
  try {
    const db = await getDb();
    
    // Access the 'inventory' collection with type safety
    const inventoryCollection = db.collection<InventoryItem>('inventory');
    
    // Fetch all items for this specific warehouse
    const items = await inventoryCollection
      .find({ warehouseId: new ObjectId(warehouseId) })
      .sort({ lastUpdated: -1 })
      .toArray();
      
    // Convert MongoDB ObjectIds to strings before returning to Client Components
    return items.map(item => ({
      ...item,
      _id: item._id?.toString() as unknown as ObjectId, // Keep typing happy for client
      warehouseId: item.warehouseId.toString() as unknown as ObjectId,
    }));
    
  } catch (error) {
    console.error('Failed to fetch inventory:', error);
    throw new Error('Could not connect to database.');
  }
}
