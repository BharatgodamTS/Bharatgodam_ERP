export const WAREHOUSE_CONFIG = [
  { name: 'Warehouse 1', ownerName: 'Rajesh Kumar', ownerEquity: 60 },
  { name: 'Warehouse 2', ownerName: 'Priya Sharma', ownerEquity: 60 },
  { name: 'Warehouse 3', ownerName: 'Amit Singh', ownerEquity: 60 },
  { name: 'Warehouse 4', ownerName: 'Sneha Patel', ownerEquity: 60 },
  { name: 'Warehouse 5', ownerName: 'Vikram Rao', ownerEquity: 60 },
] as const;

export type WarehouseConfig = (typeof WAREHOUSE_CONFIG)[number];

export interface WarehouseRevenue {
  warehouseName: string;
  ownerName: string;
  ownerEquity: number;
  totalRevenue: number;
  ownerShare: number;
  operatorShare: number;
  status: 'Settled' | 'Pending';
}

export interface RevenueDistributionData {
  warehouses: WarehouseRevenue[];
  totalCombinedRevenue: number;
  totalOwnerPayout: number;
  totalPlatformCommission: number;
  month: string;
  year: number;
}