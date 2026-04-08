import React, { useState, useEffect } from 'react';
import { Table } from '@tanstack/react-table';
import { IDetailedBooking } from '@/types/schemas';
import { ReportFilter, getCommodityOptions } from '@/app/actions/reports';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';

interface DataTableToolbarProps {
  table: Table<IDetailedBooking>;
  filters: ReportFilter;
  onFilterChange: (key: keyof ReportFilter, value: string) => void;
  onReset: () => void;
  options: { commodities: string[]; locations: string[] };
  isPending?: boolean;
}

export function DataTableToolbar({ 
  table, 
  filters, 
  onFilterChange, 
  onReset, 
  options,
  isPending 
}: DataTableToolbarProps) {
  
  const [commodityOptions, setCommodityOptions] = useState<{label: string, value: string}[]>([]);
  const [isFetchingCommodities, setIsFetchingCommodities] = useState(true);

  useEffect(() => {
    async function load() {
      setIsFetchingCommodities(true);
      const data = await getCommodityOptions();
      setCommodityOptions(data);
      setIsFetchingCommodities(false);
    }
    load();
  }, []);

  // Check if any filter is active
  const isFiltered = filters.warehouse !== 'ALL' || filters.commodity !== 'ALL' || filters.startDate !== '' || filters.endDate !== '';

  const handleWarehouseChange = (val: string) => {
    onFilterChange('warehouse', val);
    table.getColumn('warehouseName')?.setFilterValue(val === 'ALL' ? '' : val);
  };

  const handleCommodityChange = (val: string) => {
    onFilterChange('commodity', val);
    table.getColumn('commodityName')?.setFilterValue(val === 'ALL' ? '' : val);
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 sticky top-4 z-10">
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="space-y-1.5 w-full sm:w-auto">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Warehouse</label>
          <Select value={filters.warehouse || 'ALL'} onValueChange={handleWarehouseChange} disabled={isPending}>
            <SelectTrigger className="font-semibold text-slate-700 w-full sm:w-[200px]">
              <SelectValue placeholder="All Warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="font-medium">All Warehouses</SelectItem>
              <SelectItem value="Warehouse 1">Warehouse 1</SelectItem>
              <SelectItem value="Warehouse 2">Warehouse 2</SelectItem>
              <SelectItem value="Warehouse 3">Warehouse 3</SelectItem>
              <SelectItem value="Warehouse 4">Warehouse 4</SelectItem>
              <SelectItem value="Warehouse 5">Warehouse 5</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 w-full sm:w-auto">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Commodity</label>
          <Select value={filters.commodity || 'ALL'} onValueChange={handleCommodityChange} disabled={isPending || isFetchingCommodities}>
            <SelectTrigger className="font-semibold text-indigo-600 w-full sm:w-[200px]">
              {isFetchingCommodities ? (
                <span className="animate-pulse text-slate-400">Loading master DB...</span>
              ) : (
                <SelectValue placeholder="All Commodities" />
              )}
            </SelectTrigger>
            <SelectContent>
              {commodityOptions.map((c) => (
                <SelectItem key={c.value} value={c.value} className="font-medium">
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 w-full sm:w-auto">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date</label>
          <Input 
            type="date" 
            value={filters.startDate || ''} 
            onChange={(e) => onFilterChange('startDate', e.target.value)}
            className="font-medium w-full sm:w-[150px]"
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5 w-full sm:w-auto">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Date</label>
          <Input 
            type="date" 
            value={filters.endDate || ''} 
            onChange={(e) => onFilterChange('endDate', e.target.value)}
            className="font-medium w-full sm:w-[150px]"
            disabled={isPending}
          />
        </div>

        {isFiltered && (
          <Button 
            variant="ghost" 
            onClick={onReset} 
            className="text-slate-500 font-bold hover:bg-slate-100 hover:text-slate-900"
            disabled={isPending}
          >
            <X className="h-4 w-4 mr-2" /> Reset Filters
          </Button>
        )}
      </div>
    </div>
  );
}
