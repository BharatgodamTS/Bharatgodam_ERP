'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Wallet, TrendingUp, HandCoins, Filter, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RevenueDashboard() {
  const [data, setData] = useState<{ summary: any; warehouseRevenue: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    fetchWarehouseOptions();
    loadAnalytics();
  }, []);

  useEffect(() => {
    if (data !== null) {
      loadAnalytics();
    }
  }, [selectedWarehouse, selectedMonth]);

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
      const params = new URLSearchParams();
      if (selectedWarehouse !== 'ALL') params.append('warehouseId', selectedWarehouse);
      if (selectedMonth !== 'ALL') params.append('month', selectedMonth);
      
      const response = await fetch(`/api/revenue-dashboard?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load revenue analytics');
      const analytics = await response.json();
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

  const { summary, warehouseRevenue } = data!;

  const formatDecimal = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatRent = (value: number) => Math.round(value).toLocaleString();

  const formatMonthLabel = (monthKey: string) => {
    if (!monthKey || monthKey === 'Unknown') return 'N/A';
    const [year, month] = monthKey.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
  };

  const revenueRows = warehouseRevenue.flatMap((item: any) =>
    Object.entries(item.monthlyCharges)
      .map(([monthKey, rent]: [string, any]) => ({
        warehouseId: item.warehouseId,
        warehouseName: item.warehouseName,
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        rent,
        ownerShare: Math.round(rent * 0.6 * 100) / 100,
        platformShare: Math.round(rent * 0.4 * 100) / 100,
      }))
  ).sort((a, b) => {
    if (a.monthKey !== b.monthKey) return b.monthKey.localeCompare(a.monthKey); // Newest first
    return a.warehouseName.localeCompare(b.warehouseName);
  });

  const downloadCSV = () => {
    if (!revenueRows.length) return;
    
    const headers = ['Warehouse Name', 'Month', 'Rent (₹)', 'Owner Share (60%)', 'Platform Share (40%)'];
    const csvContent = [
      headers.join(','),
      ...revenueRows.map((row: any) => 
        `"${row.warehouseName}","${row.monthLabel}",${row.rent},${row.ownerShare},${row.platformShare}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    const warehouseName = selectedWarehouse === 'ALL' ? 'All_Warehouses' : (revenueRows[0]?.warehouseName || 'Warehouse').replace(/\s+/g, '_');
    link.download = `Revenue_Split_${warehouseName}_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tight text-slate-900">Revenue Distribution</h1>
        <p className="text-slate-500 font-medium">Monitor the 60/40 profit split between Warehouse Owners and the Platform.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden group">
          <div className="h-2 w-full bg-indigo-600" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black text-slate-400 flex items-center gap-2 uppercase tracking-widest">
              <TrendingUp className="h-4 w-4 text-indigo-500" /> Gross Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900 group-hover:scale-105 transition-transform duration-300 tracking-tight">₹{summary.totalRevenue.toLocaleString()}</div>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tight">Total billing generated</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden group">
          <div className="h-2 w-full bg-emerald-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black text-slate-400 flex items-center gap-2 uppercase tracking-widest">
              <Wallet className="h-4 w-4 text-emerald-500" /> Owner Earnings (60%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-emerald-600 group-hover:scale-105 transition-transform duration-300 tracking-tight">₹{summary.ownerEarnings.toLocaleString()}</div>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tight">Disbursed to operators</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden group">
          <div className="h-2 w-full bg-amber-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black text-slate-400 flex items-center gap-2 uppercase tracking-widest">
              <HandCoins className="h-4 w-4 text-amber-500" /> Platform Comm. (40%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-amber-600 group-hover:scale-105 transition-transform duration-300 tracking-tight">₹{summary.platformCommissions.toLocaleString()}</div>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tight">Service & Management fees</p>
          </CardContent>
        </Card>
      </div>

      {/* Client-Warehouse Revenue Table */}
      <Card className="bg-white border-none shadow-2xl shadow-slate-200/40 rounded-[2.5rem] overflow-hidden">
        <CardHeader className="flex flex-col gap-6 border-b border-slate-50 bg-slate-50/30 p-8 xl:p-10 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">
              Financial Breakdown
            </div>
            <CardTitle className="text-2xl font-black text-slate-900">Warehouse Revenue Summary</CardTitle>
            <p className="text-sm text-slate-500 font-medium">Month-wise revenue split across all facilities.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Warehouse</label>
              <Select value={selectedWarehouse} onValueChange={(value) => setSelectedWarehouse(value)}>
                <SelectTrigger className="min-w-[200px] rounded-2xl border-slate-200 shadow-sm">
                  <SelectValue placeholder="Filter by warehouse" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100">
                  {warehouseOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Billing Month</label>
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={selectedMonth === 'ALL' ? '' : selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value || 'ALL')}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {selectedMonth !== 'ALL' && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedMonth('ALL')} className="text-[10px] font-bold text-slate-400 hover:text-red-500">
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 justify-end h-full">
              <div className="h-6" /> {/* Spacer */}
              <Button onClick={downloadCSV} variant="outline" className="rounded-2xl border-slate-200 shadow-sm flex items-center gap-2 h-[42px]" disabled={revenueRows.length === 0}>
                <Download className="h-4 w-4" /> Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-none">
                <TableHead className="py-5 pl-10 text-[10px] font-black uppercase tracking-widest text-slate-400">Warehouse Name</TableHead>
                <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Month</TableHead>
                <TableHead className="py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Rent (₹)</TableHead>
                <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-emerald-600">Owner Share (60%)</TableHead>
                <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-amber-600">Platform Share (40%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenueRows.map((item: any, idx) => (
                <TableRow key={`${item.warehouseId}-${item.monthKey}`} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                  <TableCell className="py-6 pl-10">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${idx % 2 === 0 ? 'bg-blue-500' : 'bg-indigo-500'}`} />
                      <span className="font-bold text-slate-900">{item.warehouseName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-6">
                    <Badge variant="outline" className="rounded-lg border-slate-100 bg-white font-bold text-slate-600 px-3 py-1">
                      {item.monthLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-6 text-right font-black text-slate-900">₹{formatRent(item.rent)}</TableCell>
                  <TableCell className="py-6">
                    <div className="flex flex-col">
                      <span className="text-lg font-black text-emerald-600">₹{formatRent(item.ownerShare)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-6">
                    <div className="flex flex-col">
                      <span className="text-lg font-black text-amber-600">₹{formatRent(item.platformShare)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {revenueRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-24 text-slate-400 italic font-medium">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <Filter className="h-6 w-6 text-slate-200" />
                      </div>
                      <p>No revenue data found for the selected criteria.</p>
                      <p className="text-xs">Try selecting a different month or warehouse.</p>
                    </div>
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
