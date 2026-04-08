import { ObjectId } from 'mongodb';

export interface InventoryItem {
  _id?: ObjectId;
  sku: string;
  name: string;
  quantity: number;
  warehouseId: ObjectId;
  binLocation: string;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  lastUpdated: Date;
}

export interface User {
  _id?: ObjectId;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'PICKER';
  warehouseId?: ObjectId;
}
