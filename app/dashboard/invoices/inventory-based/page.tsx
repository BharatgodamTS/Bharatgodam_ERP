'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface InventoryPeriod {
  startDate: string;
  endDate: string;
  days: number;
  inventory: number;
  dailyRate: number;
  charge: number;
  calculation: string;
}

interface BillingData {
  monthYear: string;
  client: { id: string };
  warehouse: { id: string };
  commodity: { id: string; name: string };
  ratePerMTPerMonth: number;
  dailyRatePerMT: number;
  transactions: {
    inwards: Array<{ date: string; quantity: number; id: string }>;
    outwards: Array<{ date: string; quantity: number; id: string }>;
  };
  billing: {
    monthYear: string;
    daysInMonth: number;
    daysWithInventory: number;
    peakInventory: number;
    periods: InventoryPeriod[];
    totalAmount: number;
  };
}

export default function InventoryBillingDemo() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BillingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Test with Sureshwar Corporation - January 2026
  const testClientId = '67a1e8c4b1234567890abcde';
  const testWarehouseId = '67a1e8c4b1234567890abcdf';
  const testCommodityId = '67a1e8c4b1234567890abc12';
  const testMonth = '2026-01';

  const fetchBillingData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        clientId: testClientId,
        warehouseId: testWarehouseId,
        commodityId: testCommodityId,
        month: testMonth,
      });

      const response = await fetch(`/api/invoices/inventory-based?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch billing data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">Loading billing data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchBillingData}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">No data available</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Inventory-Based Monthly Invoice</h1>
        <p className="text-slate-600 mt-2">
          Month-wise billing based on actual inventory levels
        </p>
      </div>

      {/* Invoice Details */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
          <CardDescription>{data.monthYear}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-slate-600">Commodity</p>
            <p className="font-semibold">{data.commodity.name}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Rate</p>
            <p className="font-semibold">₹{data.ratePerMTPerMonth}/MT/month</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Daily Rate</p>
            <p className="font-semibold">₹{data.dailyRatePerMT}/MT/day</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Days in Month</p>
            <p className="font-semibold">{data.billing.daysInMonth} days</p>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Days with Inventory</p>
            <p className="text-2xl font-bold mt-2">{data.billing.daysWithInventory}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Peak Inventory</p>
            <p className="text-2xl font-bold mt-2">{data.billing.peakInventory} MT</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Transactions</p>
            <p className="text-2xl font-bold mt-2">
              {data.transactions.inwards.length + data.transactions.outwards.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {data.transactions.inwards.length} in, {data.transactions.outwards.length} out
            </p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Total Invoice</p>
            <p className="text-2xl font-bold mt-2 text-green-700">
              ₹{data.billing.totalAmount.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inward Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.transactions.inwards.map((inward) => (
                <div
                  key={inward.id}
                  className="flex justify-between p-2 bg-blue-50 rounded"
                >
                  <span className="font-mono text-sm">{inward.date}</span>
                  <span className="font-semibold text-blue-700">+{inward.quantity} MT</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Outward Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.transactions.outwards.map((outward) => (
                <div
                  key={outward.id}
                  className="flex justify-between p-2 bg-red-50 rounded"
                >
                  <span className="font-mono text-sm">{outward.date}</span>
                  <span className="font-semibold text-red-700">-{outward.quantity} MT</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Billing Periods */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Periods</CardTitle>
          <CardDescription>
            Breakdown of charges by inventory level and period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.billing.periods.map((period, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg bg-slate-50 hover:bg-slate-100 transition"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold">
                      Period {index + 1}: {period.startDate} to {period.endDate}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {period.days} day{period.days > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-700">
                      ₹{period.charge.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                  <div>
                    <p className="text-slate-600">Inventory</p>
                    <p className="font-semibold">{period.inventory} MT</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Daily Rate</p>
                    <p className="font-semibold">₹{period.dailyRate}/MT/day</p>
                  </div>
                </div>

                <div className="mt-3 p-2 bg-white rounded border border-slate-200">
                  <p className="text-sm font-mono text-slate-700">
                    {period.calculation}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-6 pt-4 border-t-2 border-slate-300">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total January 2026 Invoice</span>
              <span className="text-2xl font-bold text-green-700">
                ₹{data.billing.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Summary Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left">Period</th>
                  <th className="px-4 py-2 text-center">Days</th>
                  <th className="px-4 py-2 text-center">Inventory (MT)</th>
                  <th className="px-4 py-2 text-center">Daily Rate (₹)</th>
                  <th className="px-4 py-2 text-right">Charge (₹)</th>
                </tr>
              </thead>
              <tbody>
                {data.billing.periods.map((period, index) => (
                  <tr key={index} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono">
                      {period.startDate} - {period.endDate}
                    </td>
                    <td className="px-4 py-2 text-center">{period.days}</td>
                    <td className="px-4 py-2 text-center font-semibold">
                      {period.inventory}
                    </td>
                    <td className="px-4 py-2 text-center">{period.dailyRate.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      ₹{period.charge.toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold bg-green-50 border-t-2 border-green-300">
                  <td colSpan={4} className="px-4 py-2">
                    Total
                  </td>
                  <td className="px-4 py-2 text-right text-green-700">
                    ₹{data.billing.totalAmount.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
