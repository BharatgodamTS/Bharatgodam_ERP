'use client';

import { useState, useEffect } from 'react';
import { getRevenueAnalyticsFromInvoices } from '@/app/actions/transaction-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Wallet, TrendingUp, HandCoins, Receipt, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RevenueDashboard() {
  const [data, setData] = useState<{ summary: any; monthlyWarehouseRevenue: any[]; recentLogs: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState('ALL');
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    fetchWarehouseOptions();
    loadAnalytics();
  }, []);

  useEffect(() => {
    if (data !== null) {
      loadAnalytics();
    }
  }, [selectedWarehouse]);

  const fetchWarehouseOptions = async () => {
    try {
      const response = await fetch('/api/warehouses');
      if (!response.ok) throw new Error('Failed to load warehouses');
      const result = await response.json();
      const options = result.warehouses?.map((warehouse: any) => ({
        label: warehouse.name,
        value: warehouse._id || warehouse.id,
      })) || [];
      setWarehouseOptions([{ label: 'All Warehouses', value: 'ALL' }, ...options]);
    } catch (error) {
      console.error('Warehouse load failed:', error);
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const analytics = await getRevenueAnalyticsFromInvoices(selectedWarehouse === 'ALL' ? undefined : selectedWarehouse);
      setData(analytics);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center animate-pulse text-slate-500">Calculating revenue splits...</div>;
  }

  const { summary, monthlyWarehouseRevenue, recentLogs } = data!;

  const formatDecimal = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatRent = (value: number) => Math.round(value).toLocaleString();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Revenue Distribution</h1>
        <p className="text-slate-500">Monitor the 60/40 profit split between Warehouse Owners and the Platform.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-l-4 border-l-indigo-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2 uppercase tracking-wider">
              <TrendingUp className="h-4 w-4" /> Gross Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">₹{summary.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-1">Total billing generated across all clients.</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2 uppercase tracking-wider">
              <Wallet className="h-4 w-4" /> Owner Earnings (60%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-600">₹{summary.ownerEarnings.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-1">Net profit disbursed to warehouse operators.</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2 uppercase tracking-wider">
              <HandCoins className="h-4 w-4" /> Platform Comm. (40%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-amber-600">₹{summary.platformCommissions.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-1">Management fees and platform service charges.</p>
          </CardContent>
        </Card>
      </div>

      {/* Month-wise Warehouse Revenue */}
      <Card className="bg-white">
        <CardHeader className="flex flex-col gap-4 border-b bg-slate-50/50 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-bold">Month-wise Revenue by Warehouse</CardTitle>
            <p className="text-xs text-slate-500">60/40 revenue split breakdown for each warehouse per month (from ledger entries).</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <Filter className="h-3 w-3 text-slate-500" />
              <Select value={selectedWarehouse} onValueChange={(value) => setSelectedWarehouse(value)}>
                <SelectTrigger className="min-w-[220px]">
                  <SelectValue placeholder="Filter by warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouseOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Quantity Days</TableHead>
                <TableHead className="text-right">Avg Qty (MT)</TableHead>
                <TableHead className="text-right">Rent (₹)</TableHead>
                <TableHead className="text-right">Ending Inventory (MT)</TableHead>
                <TableHead className="text-emerald-600">Owner (60%)</TableHead>
                <TableHead className="text-amber-600">Platform (40%)</TableHead>
                <TableHead className="text-center">Ledger Entries</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyWarehouseRevenue.map((item: any) => {
                const monthParts = typeof item.month === 'string' ? item.month.split('-') : [];
                const monthDate = monthParts.length === 2 && !Number.isNaN(parseInt(monthParts[1], 10))
                  ? new Date(item.year, parseInt(monthParts[1], 10) - 1)
                  : null;

                return (
                  <TableRow key={`${item.warehouseId}-${item.month}`} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium text-slate-900">
                      {monthDate ? format(monthDate, 'MMM yyyy') : item.month || 'Unknown Month'}
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-slate-900">{item.warehouseName}</div>
                      <div className="text-xs text-slate-500">{item.month || 'N/A'}</div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{item.totalDays ?? 0}</TableCell>
                    <TableCell className="text-right">{formatDecimal(item.totalQuantityDays ?? 0)}</TableCell>
                    <TableCell className="text-right">{formatDecimal(item.avgQuantityMT ?? 0)}</TableCell>
                    <TableCell className="text-right font-bold">₹{formatRent(item.totalRevenue ?? 0)}</TableCell>
                    <TableCell className="text-right">{formatDecimal(item.endingInventory ?? 0)}</TableCell>
                    <TableCell className="text-emerald-600 font-bold">₹{formatRent(item.ownerShare ?? 0)}</TableCell>
                    <TableCell className="text-amber-600 font-bold">₹{formatRent(item.platformShare ?? 0)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono">
                        {item.ledgerCount ?? 0}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {monthlyWarehouseRevenue.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 italic">
                    No revenue data found for the selected period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transaction Log */}
      <Card className="bg-white">
        <CardHeader className="flex flex-col gap-4 border-b bg-slate-50/50 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-bold">Distribution Audit Log</CardTitle>
            <p className="text-xs text-slate-500">Live feed of revenue splits for every inward entry.</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Client & Warehouse</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead className="text-emerald-600">Owner (60%)</TableHead>
                <TableHead className="text-amber-600">Platform (40%)</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs && recentLogs.length > 0 ? recentLogs.map((log: any) => (
                <TableRow key={log._id} className="hover:bg-slate-50/50">
                  <TableCell className="text-xs font-medium text-slate-600">
                    {format(new Date(log.createdAt), 'MMM dd, HH:mm')}
                  </TableCell>
                  <TableCell>
                    <p className="font-bold text-slate-900">{log.clientId?.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">{log.warehouseId?.name}</p>
                  </TableCell>
                  <TableCell className="font-bold">₹{(log.totalAmount || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-emerald-600 font-bold">₹{(log.ownerShare || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-amber-600 font-bold">₹{(log.platformShare || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Receipt className="h-4 w-4 text-slate-400" />
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No recent ledger entries found
                  </TableCell>
                </TableRow>
              )}
              {recentLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 italic">
                    No revenue log entries found yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
