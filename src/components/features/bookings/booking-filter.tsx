'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTransition } from 'react';

interface BookingFilterProps {
  commodities: { label: string; value: string }[];
  currentCommodity: string;
  currentPage: number;
  totalPages: number;
}

export default function BookingFilter({
  commodities,
  currentCommodity,
  currentPage,
  totalPages
}: BookingFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleCommodityChange = (value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      if (value === 'ALL') {
        params.delete('commodity');
      } else {
        params.set('commodity', value);
      }
      params.set('page', '1'); // Reset to first page when filtering
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleReset = () => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      params.delete('commodity');
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handlePageChange = (page: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      params.set('page', page.toString());
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const isFiltered = currentCommodity !== 'ALL';

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-6">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex items-center gap-2 mb-2 sm:mb-0">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Filter Bookings</span>
          </div>

          <div className="space-y-1.5 w-full sm:w-auto">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Commodity</label>
            <Select value={currentCommodity} onValueChange={handleCommodityChange} disabled={isPending}>
              <SelectTrigger className="font-semibold text-indigo-600 w-full sm:w-[200px]">
                <SelectValue placeholder="All Commodities" />
              </SelectTrigger>
              <SelectContent>
                {commodities.map((commodity) => (
                  <SelectItem key={commodity.value} value={commodity.value} className="font-medium">
                    {commodity.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isFiltered && (
            <Button
              variant="ghost"
              onClick={handleReset}
              className="text-slate-500 font-bold hover:bg-slate-100 hover:text-slate-900"
              disabled={isPending}
            >
              <X className="h-4 w-4 mr-1" />
              Reset
            </Button>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 mr-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isPending}
              className="text-slate-600 hover:text-slate-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isPending}
              className="text-slate-600 hover:text-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
