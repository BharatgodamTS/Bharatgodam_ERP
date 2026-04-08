'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, TrendingUp, Building2, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/distribution-engine';
import { RevenueDistributionData } from '@/lib/revenue-types';
import RevenueTable from './revenue-table';
import { generateDistributionReport } from './pdf-generator';

interface RevenueDistributionClientProps {
  initialData: RevenueDistributionData;
  initialMonth: number;
  initialYear: number;
}

export default function RevenueDistributionClient({
  initialData,
  initialMonth,
  initialYear,
}: RevenueDistributionClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [data, setData] = useState(initialData);

  const handleMonthChange = (month: string) => {
    const newMonth = parseInt(month);
    setSelectedMonth(newMonth);
    updateData(newMonth, selectedYear);
  };

  const handleYearChange = (year: string) => {
    const newYear = parseInt(year);
    setSelectedYear(newYear);
    updateData(selectedMonth, newYear);
  };

  const updateData = (month: number, year: number) => {
    startTransition(async () => {
      const params = new URLSearchParams(searchParams);
      params.set('month', month.toString());
      params.set('year', year.toString());
      router.push(`/dashboard/revenue-distribution?${params.toString()}`);
    });
  };

  const handleDownloadReport = async () => {
    try {
      await generateDistributionReport(data);
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Revenue Distribution
          </h1>
          <p className="text-slate-600 mt-1">
            Monthly income split between warehouse owners and platform operators
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedMonth.toString()} onValueChange={handleMonthChange} disabled={isPending}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear.toString()} onValueChange={handleYearChange} disabled={isPending}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleDownloadReport} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">Total Combined Revenue</p>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(data.totalCombinedRevenue)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
          <p className="text-xs text-blue-700 mt-4">{data.month} {data.year}</p>
        </div>

        <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-900">Total Owner Payout</p>
              <p className="text-2xl font-bold text-amber-900">{formatCurrency(data.totalOwnerPayout)}</p>
            </div>
            <Building2 className="h-8 w-8 text-amber-600" />
          </div>
          <p className="text-xs text-amber-700 mt-4">60% owner share</p>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-900">Total Platform Commission</p>
              <p className="text-2xl font-bold text-green-900">{formatCurrency(data.totalPlatformCommission)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-xs text-green-700 mt-4">40% operator share</p>
        </div>
      </div>

      {/* Revenue Table */}
      <RevenueTable data={data.warehouses} />
    </div>
  );
}