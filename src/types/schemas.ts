import { ObjectId } from 'mongodb';

export interface IUser {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  createdAt: Date;
}

export interface IZone {
  _id?: ObjectId;
  name: string;
  totalCapacity: number;
  type: 'DRY_STORAGE' | 'COLD_STORAGE' | 'HAZARDOUS';
  pricePerSqFt: number;
}

export interface IWarehouse {
  _id?: ObjectId;
  name: string;
  ownerName: string;
  ownerEquity: number; // Percentage (e.g., 60 for 60%)
  location: string;
  capacity: number;
  type: 'DRY_STORAGE' | 'COLD_STORAGE' | 'HAZARDOUS';
  createdAt: Date;
  updatedAt: Date;
}

export interface ILogisticsBooking {
  _id?: ObjectId;
  userId: ObjectId;
  customerName: string;      
  mobileNumber: string;      
  commodity: 'GRAINS' | 'ELECTRONICS' | 'CHEMICALS' | 'STEEL' | 'PERISHABLES'; 
  truckNumber: string;       
  weightTons: number;        
  startDate: Date;
  endDate: Date;
  warehouseId?: ObjectId; // Reference to warehouse
  warehouseName?: string; // Denormalized for performance
  
  // 1. Flow & Location
  direction: 'INWARD' | 'OUTWARD';
  date: string; // ISO Date String
  warehouseName: string;
  location: string;

  // 2. Stakeholders
  clientName: string;
  clientLocation?: string;
  suppliers?: string;

  // 3. Tracking Specs
  commodityName: string;
  cadNo?: string;
  stackNo?: string;
  lotNo?: string;
  doNumber?: string;
  cdfNo?: string;

  // 4. Gate & Quantities
  gatePass: string;
  pass?: string;
  bags: number;
  palaBags: number;
  mt: number;

  // 5. Billing Configuration
  storageDays: number;
  
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
}

export interface IInvoice {
  _id?: ObjectId;
  bookingId: ObjectId;
  sNo?: number; // Mapping backwards compatibility to Legacy Array
  clientEmail: string;
  customerName: string;
  commodity: string;
  warehouseId?: ObjectId; // Reference to warehouse
  warehouseName?: string; // Denormalized for performance
  durationDays?: number; // Legacy daily tracker
  daysStored?: number; // New outward withdrawal tracker
  billingCycles?: number; // Monthly calculation brackets
  rateApplied: number;
  baseStorageCost?: number; // Decoupled storage vs handling
  handlingFee?: number;
  subtotal: number;
  totalAmount?: number; // Final total (no tax)
  finalTotal?: number; // Final Settlement sum
  paidAmount?: number; // Amount already paid
  pendingAmount?: number; // Amount still due (calculated)
  status: 'UNPAID' | 'PAID' | 'PENDING_SETTLEMENT' | 'PARTIALLY_PAID';
  invoiceType?: 'STANDARD_STORAGE' | 'FINAL_WITHDRAWAL';
  generatedAt: Date;
  createdBy?: string;
}
