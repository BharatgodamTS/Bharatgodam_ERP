'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { DataTableToolbar } from './data-table-toolbar';
import { IDetailedBooking } from '@/types/schemas';
import { getFilteredBookings, getFilterOptions, ReportFilter } from '@/app/actions/reports';
import BookingDetailSheet from './booking-detail-sheet';
import ReportSkeleton from './report-skeleton';
import { 
  Download, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Settings2,
  Calendar as CalendarIcon,
  Truck,
  ArrowUpDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

interface Props {
  initialData: IDetailedBooking[];
  initialTotalPages: number;
  initialTotalCount: number;
  initialOptions: { commodities: string[]; locations: string[] };
  initialFilters: any;
}

const LogisticsReportClient = ({ 
  initialData, 
  initialTotalPages, 
  initialTotalCount, 
  initialOptions, 
  initialFilters 
}: Props) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [data, setData] = useState<IDetailedBooking[]>(initialData);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [loading, setLoading] = useState(false); // Initial load is done by Server
  const [isPending, startTransition] = React.useTransition();
  const [options, setOptions] = useState(initialOptions);
  
  // Table State
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    clientLocation: false,
    suppliers: false,
    cadNo: false,
    doNumber: false,
    cdfNo: false,
    pass: false,
    palaBags: false,
  });
  const [rowSelection, setRowSelection] = useState({});
  const [selectedBooking, setSelectedBooking] = useState<IDetailedBooking | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Filter Bar State
  const [filters, setFilters] = useState<ReportFilter>({
    startDate: initialFilters.startDate || '',
    endDate: initialFilters.endDate || '',
    warehouse: initialFilters.warehouse || 'ALL',
    commodity: initialFilters.commodity || 'ALL',
    location: initialFilters.location || 'ALL',
    page: initialFilters.page || 1,
    limit: initialFilters.limit || 20,
  });

  // Table Pagination State
  const [pagination, setPagination] = useState({
    pageIndex: (initialFilters.page || 1) - 1,
    pageSize: initialFilters.limit || 20,
  });

  // Effect to handle pagination changes
  useEffect(() => {
    const newPage = pagination.pageIndex + 1;
    if (newPage !== filters.page) {
      handleFilterChange('page', newPage.toString());
    }
  }, [pagination.pageIndex]);

  // Initial Fetch - No longer needed! Server handles it.

  // Handle Filter Changes
  const handleFilterChange = (key: keyof ReportFilter | 'page', value: string) => {
    // If a non-page filter changes, optionally reset to page 1
    const isResettingPage = key !== 'page' && key !== 'limit';
    
    const newFilters = { 
      ...filters, 
      [key]: key === 'page' ? parseInt(value) : value,
      ...(isResettingPage && { page: 1 })
    };
    
    setFilters(newFilters);
    if(isResettingPage) setPagination(prev => ({ ...prev, pageIndex: 0 }));

    // URL Sync for Filters
    const params = new URLSearchParams(searchParams.toString());
    
    if (key === 'commodity' || key === 'warehouse') {
      if (value === 'ALL') params.delete(key);
      else params.set(key, value);
    }
    
    if (key === 'page') params.set('page', value.toString());
    if (isResettingPage) params.set('page', '1');

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });

    // Auto-fetch data transition after local update completes
    startTransition(async () => {
      const res = await getFilteredBookings(newFilters);
      if (res.success) {
        setData(res.data || []);
        setTotalPages(res.totalPages || 0);
        setTotalCount(res.totalCount || 0);
      } else {
        toast.error(res.message || 'Filter failed');
      }
    });
  };

  const resetFilters = async () => {
    const emptyFilters = { startDate: '', endDate: '', warehouse: 'ALL', commodity: 'ALL', location: 'ALL' };
    setFilters(emptyFilters);
    table.getColumn('warehouseName')?.setFilterValue(''); // Reset local table filter
    table.getColumn('commodityName')?.setFilterValue(''); // Reset local table filter
    router.replace(pathname, { scroll: false }); // Clear URL parameters

    setLoading(true);
    const res = await getFilteredBookings(emptyFilters);
    if (res.success) setData(res.data || []);
    setLoading(false);
  };

  // Export to Excel
  const exportToExcel = () => {
    try {
      const exportData = data.map(item => ({
        'S.No': item.sNo,
        'Direction': item.direction,
        'Inward Date': item.date,
        'Warehouse': item.warehouseName,
        'Location': item.location,
        'Client Name': item.clientName,
        'Client Loc': item.clientLocation || '',
        'Suppliers': item.suppliers || '',
        'Commodity': item.commodityName,
        'CAD No': item.cadNo || '',
        'Stack No': item.stackNo || '',
        'Lot No': item.lotNo || '',
        'DO Number': item.doNumber || '',
        'CDF No': item.cdfNo || '',
        'Gate Pass': item.gatePass,
        'Pass': item.pass || '',
        'Bags (Qty)': item.bags,
        'Pala Bags': item.palaBags,
        'MT (Weight)': item.mt,
        'Storage Days': item.storageDays,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Logistics Report');
      
      // Auto-size columns
      const maxWidths = exportData.reduce((acc: any, row) => {
        Object.entries(row).forEach(([key, val], idx) => {
          const length = Math.max(key.length, String(val).length);
          acc[idx] = Math.max(acc[idx] || 0, length);
        });
        return acc;
      }, []);
      worksheet['!cols'] = maxWidths.map((w: number) => ({ wch: w + 2 }));

      XLSX.writeFile(workbook, `WMS_Logistics_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export Excel');
    }
  };

  // Table Columns Definition (18+ Fields)
  const columns = useMemo<ColumnDef<IDetailedBooking>[]>(() => [
    {
      accessorKey: 'sNo',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 font-bold">
          S.No <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-bold text-slate-900">#{row.getValue('sNo')}</span>,
    },
    {
      accessorKey: 'direction',
      header: 'Flow',
      cell: ({ row }) => {
        const direction = row.getValue('direction') as string;
        return (
          <Badge variant={direction === 'INWARD' ? 'success' : 'default'} className="text-[10px]">
            {direction}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ row }) => <span className="text-slate-600 font-medium whitespace-nowrap">{row.getValue('date')}</span>,
    },
    {
      accessorKey: 'clientName',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 font-bold">
          Client Name <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-semibold text-slate-800 line-clamp-1 max-w-[150px]">{row.getValue('clientName')}</span>,
    },
    {
      accessorKey: 'commodityName',
      header: 'Commodity',
      cell: ({ row }) => <span className="font-bold text-indigo-600 tracking-tight">{row.getValue('commodityName')}</span>,
    },
    {
      accessorKey: 'warehouseName', // Make sure table can filter on this accessor
      header: 'Warehouse',
      cell: ({ row }) => <span className="font-bold text-slate-700">{row.getValue('warehouseName')}</span>,
    },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => <span className="text-slate-500 font-medium line-clamp-1">{row.getValue('location')}</span>,
    },
    {
      accessorKey: 'lotNo',
      header: 'Lot No',
    },
    {
      accessorKey: 'gatePass',
      header: 'Gate Pass',
      cell: ({ row }) => <span className="font-mono text-slate-500 text-xs">{row.getValue('gatePass')}</span>,
    },
    {
      accessorKey: 'mt',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 font-bold">
          Weight (MT) <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-black text-slate-900">{row.getValue('mt')}</span>,
    },
    {
      accessorKey: 'storageDays',
      header: 'Days',
      cell: ({ row }) => <span className="text-emerald-600 font-bold">{row.getValue('storageDays')}d</span>,
    },
    // Hidden fields for standard view
    { accessorKey: 'clientLocation', header: 'Client Location' },
    { accessorKey: 'suppliers', header: 'Suppliers' },
    { accessorKey: 'cadNo', header: 'CAD No' },
    { accessorKey: 'doNumber', header: 'DO Number' },
    { accessorKey: 'cdfNo', header: 'CDF No' },
    { accessorKey: 'pass', header: 'Pass' },
    { accessorKey: 'bags', header: 'Bags' },
    { accessorKey: 'palaBags', header: 'Pala' },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
          onClick={() => {
            setSelectedBooking(row.original);
            setIsSheetOpen(true);
          }}
        >
          <Eye className="h-4 w-4 mr-1.5" /> View
        </Button>
      ),
    },
  ], [data]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      pagination,
    },
    enableRowSelection: true,
    manualPagination: true,
    pageCount: totalPages,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-6">
      
      {/* 1. Header Information */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6 text-indigo-600" />
            Logistics Movement Report
          </h1>
          <p className="text-slate-500 font-medium">Aggregated warehouse bookings across 18+ logistics fields.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToExcel} className="font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <Download className="h-4 w-4 mr-2" /> Export Excel
          </Button>
          <Button variant="secondary" size="sm" className="font-bold">
            <Settings2 className="h-4 w-4 mr-2" /> Settings
          </Button>
        </div>
      </div>

      {/* 2. Advanced Multi-Filter Bar */}
      <DataTableToolbar 
        table={table}
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={resetFilters}
        options={options}
        isPending={isPending || loading}
      />

      {/* 3. The Data Grid (TanStack) */}
      {loading ? (
        <ReportSkeleton />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <p className="text-sm font-bold text-slate-500">
              Showing <span className="text-slate-900">{data.length}</span> of <span className="text-slate-900">{totalCount}</span> movements
            </p>
            <div className="flex items-center gap-4">
              <p className="text-xs text-slate-400">Page {pagination.pageIndex + 1} of {totalPages}</p>
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {data.length > 0 ? (
                table.getRowModel().rows.map(row => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <Truck className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-lg font-bold">No records found for this criteria</p>
                      <p className="text-sm mt-1">Try adjusting your Warehouse, Commodity, or Date range.</p>
                      <Button variant="outline" onClick={resetFilters} className="mt-4">
                        Clear All Filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 4. Detailed View Sheet */}
      <BookingDetailSheet 
        booking={selectedBooking} 
        isOpen={isSheetOpen} 
        onClose={() => setIsSheetOpen(false)} 
      />
    </div>
  );
};

export default LogisticsReportClient;
