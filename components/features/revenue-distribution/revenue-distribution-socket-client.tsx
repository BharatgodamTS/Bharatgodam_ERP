'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCcw, Building2, DollarSign, Users, Filter } from 'lucide-react';

const REVENUE_API_BASE = process.env.NEXT_PUBLIC_REVENUE_API_BASE || 'http://localhost:4000';

type WarehouseOption = {
  label: string;
  value: string;
};

type RevenueRecord = {
  _id: string;
  booking_id: string;
  warehouse_id: string;
  warehouse_name: string;
  total_amount: number;
  owner_share: number;
  platform_share: number;
  createdAt: string;
};

type RevenueSummary = {
  totalRevenue: number;
  totalOwnerShare: number;
  totalPlatformShare: number;
};

type RevenueResponse = {
  success: boolean;
  summary: RevenueSummary;
  records: RevenueRecord[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

export default function RevenueDistributionSocketClient() {
  const [records, setRecords] = useState<RevenueRecord[]>([]);
  const [summary, setSummary] = useState<RevenueSummary>({ totalRevenue: 0, totalOwnerShare: 0, totalPlatformShare: 0 });
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warehouseOptions, setWarehouseOptions] = useState<WarehouseOption[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const socketRef = useRef<Socket | null>(null);
  const firstDataFetchAttemptedRef = useRef(false);

  const fetchWarehouseOptions = async () => {
    try {
      const response = await fetch('/api/revenue-warehouses');
      if (response.ok) {
        const warehouses = await response.json();
        setWarehouseOptions([
          { label: 'All Warehouses', value: 'ALL' },
          ...warehouses.map((w: any) => ({
            label: w.name,
            value: w.name,
          }))
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch warehouse options:', error);
    }
  };

  const fetchRevenueDistribution = async (warehouseFilter = 'ALL') => {
    setLoading(true);

    try {
      const url = warehouseFilter === 'ALL'
        ? `${REVENUE_API_BASE}/api/revenue-distribution`
        : `${REVENUE_API_BASE}/api/revenue-distribution?warehouse=${warehouseFilter}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load revenue distribution (${response.status})`);
      }

      const data: RevenueResponse = await response.json();
      if (!data.success) {
        throw new Error('Revenue API error');
      }

      setSummary(data.summary);
      setRecords(data.records);
      setErrorMessage(null); // Clear errors on successful fetch
      firstDataFetchAttemptedRef.current = true;
    } catch (error) {
      firstDataFetchAttemptedRef.current = true;
      const message = error instanceof Error ? error.message : 'Unable to fetch revenue data';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouseOptions();
    fetchRevenueDistribution();

    const socket = io(REVENUE_API_BASE, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      setErrorMessage(null);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('revenueUpdated', (payload: { record: RevenueRecord; summary: RevenueSummary }) => {
      setRecords((current) => [payload.record, ...current]);
      setSummary(payload.summary);
    });

    socket.on('connect_error', (error) => {
      // Suppress console spam for transient connection errors
      // Only show error in UI if initial data fetch also failed
      if (firstDataFetchAttemptedRef.current && records.length === 0) {
        setErrorMessage('Real-time updates unavailable. Retrying...');
      }
      // Silently track connection state without console errors
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleWarehouseFilterChange = (value: string) => {
    setSelectedWarehouse(value);
    fetchRevenueDistribution(value);
  };

  const totalRows = records.length;
  const hasData = totalRows > 0;

  const statusText = useMemo(() => {
    if (socketConnected) {
      return 'Live updates enabled';
    }
    if (loading) {
      return 'Connecting...';
    }
    return 'Real-time disconnected';
  }, [socketConnected, loading]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Revenue Distribution</h1>
          <p className="mt-2 text-sm text-slate-600">
            Live warehouse revenue split between owner and platform.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <Select value={selectedWarehouse} onValueChange={handleWarehouseFilterChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouseOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${socketConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {statusText}
          </span>
          <Button onClick={() => fetchRevenueDistribution(selectedWarehouse)} disabled={loading} className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Revenue</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(summary.totalRevenue)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-slate-600" />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Owner Share (60%)</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(summary.totalOwnerShare)}</p>
            </div>
            <Users className="h-8 w-8 text-slate-600" />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Platform Share (40%)</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(summary.totalPlatformShare)}</p>
            </div>
            <Building2 className="h-8 w-8 text-slate-600" />
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <p className="text-sm font-semibold text-slate-900">Revenue Breakdown</p>
          <p className="mt-1 text-xs text-slate-500">Latest payment records appear instantly when a new transaction is processed.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.18em] text-slate-600">
              <tr>
                <th className="px-4 py-3">Warehouse Name</th>
                <th className="px-4 py-3">Booking ID</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-right">Owner Share</th>
                <th className="px-4 py-3 text-right">Platform Share</th>
                <th className="px-4 py-3">Received At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-[10px] text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Loading revenue data...
                  </td>
                </tr>
              ) : !hasData ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No revenue records available yet.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record._id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-900">{record.warehouse_name}</td>
                    <td className="px-4 py-4">{record.booking_id}</td>
                    <td className="px-4 py-4 text-right">{formatCurrency(record.total_amount)}</td>
                    <td className="px-4 py-4 text-right text-emerald-700">{formatCurrency(record.owner_share)}</td>
                    <td className="px-4 py-4 text-right text-sky-700">{formatCurrency(record.platform_share)}</td>
                    <td className="px-4 py-4">{new Date(record.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {errorMessage && records.length === 0 ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
          <p className="font-medium text-red-900">{errorMessage}</p>
          <p className="mt-1 text-xs text-red-700">
            Make sure the revenue server is running: <code className="bg-red-100 px-2 py-1">npm run serve:revenue</code>
          </p>
        </div>
      ) : null}
    </div>
  );
}
