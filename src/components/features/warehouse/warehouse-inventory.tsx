'use client';

import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Package, TrendingUp, AlertTriangle, BarChart3, Building2, Loader2 } from 'lucide-react';
import { formatWeight } from '@/lib/utils';

interface CommodityData {
  commodityName: string;
  totalWeight: number;
  bookingCount: number;
}

interface WarehouseStats {
  total_capacity: number;
  used_capacity: number;
  available_capacity: number;
  utilization_percentage: number;
  warehouse_id: string;
  warehouse_name: string;
}

interface InventoryResponse {
  success: boolean;
  commodities: CommodityData[];
  warehouse_stats: WarehouseStats;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

const WAREHOUSES = [
  { id: 'WH1', name: 'Warehouse 1' },
  { id: 'WH2', name: 'Warehouse 2' },
  { id: 'WH3', name: 'Warehouse 3' },
  { id: 'WH4', name: 'Warehouse 4' },
  { id: 'WH5', name: 'Warehouse 5' }
];

const TOTAL_CAPACITY = 5000;

export default function WarehouseInventory() {
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState('WH1');

  useEffect(() => {
    fetchInventoryData();
  }, [selectedWarehouse]);

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/warehouse/inventory?warehouseId=${selectedWarehouse}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch inventory data (${response.status})`);
      }

      const result: InventoryResponse = await response.json();
      if (!result.success) {
        throw new Error('API returned error');
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const getCapacityStatus = (percentage: number) => {
    if (percentage >= 90) return { color: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle };
    if (percentage >= 75) return { color: 'text-amber-600', bg: 'bg-amber-50', icon: TrendingUp };
    return { color: 'text-green-600', bg: 'bg-green-50', icon: Package };
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 rounded w-full"></div>
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">Error loading inventory data</span>
        </div>
        <p className="text-slate-600 mt-2">{error}</p>
        <button
          onClick={fetchInventoryData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { commodities, warehouse_stats } = data;
  const usedCapacity = warehouse_stats.used_capacity;
  const availableCapacity = Math.max(0, TOTAL_CAPACITY - usedCapacity);
  const utilizationPercentage = Math.round((usedCapacity / TOTAL_CAPACITY) * 100);
  const capacityStatus = getCapacityStatus(utilizationPercentage);

  // Prepare data for the pie chart
  const chartData = commodities.map((commodity, index) => ({
    name: commodity.commodityName,
    value: commodity.totalWeight,
    color: COLORS[index % COLORS.length]
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Warehouse Inventory</h2>
            <p className="text-slate-600 mt-1">Commodity breakdown and capacity management</p>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-500" />
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {WAREHOUSES.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={fetchInventoryData}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
        >
          <BarChart3 className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Capacity Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Capacity</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">
                {formatWeight(TOTAL_CAPACITY)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {warehouse_stats.warehouse_name}
              </p>
            </div>
            <Package className="h-8 w-8 text-slate-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Used Capacity</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">
                {formatWeight(warehouse_stats.used_capacity)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {utilizationPercentage}% utilized
              </p>
            </div>
            <capacityStatus.icon className={`h-8 w-8 ${capacityStatus.color}`} />
          </div>
        </div>

        <div className={`rounded-xl border border-slate-200 p-6 shadow-sm ${capacityStatus.bg}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Available Capacity</p>
              <p className={`text-2xl font-semibold mt-1 ${capacityStatus.color}`}>
                {formatWeight(availableCapacity)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Ready for new bookings
              </p>
            </div>
            <Package className={`h-8 w-8 ${capacityStatus.color}`} />
          </div>
        </div>
      </div>

      {/* Capacity Visualization */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Capacity Utilization</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm text-slate-600 mb-2">
              <span>Used Capacity</span>
              <span>{utilizationPercentage}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  utilizationPercentage >= 90 ? 'bg-red-500' :
                  utilizationPercentage >= 75 ? 'bg-amber-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${Math.min(utilizationPercentage, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>0 MT</span>
              <span>{formatWeight(TOTAL_CAPACITY)}</span>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [typeof value === 'number' ? formatWeight(value) : '0 MT', 'Weight']}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Commodity Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Commodity Breakdown</h3>
          <p className="text-slate-600 text-sm mt-1">Current inventory by commodity type</p>
        </div>

        {commodities.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">No commodities currently stored</p>
            <p className="text-slate-500 text-sm mt-1">Warehouse is empty and ready for new bookings</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {commodities.map((commodity, index) => (
              <div key={commodity.commodityName} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <div>
                      <h4 className="font-medium text-slate-900">{commodity.commodityName}</h4>
                      <p className="text-sm text-slate-600">
                        {commodity.bookingCount} booking{commodity.bookingCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-slate-900">
                      {formatWeight(commodity.totalWeight)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {((commodity.totalWeight / warehouse_stats.used_capacity) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}