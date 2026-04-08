import LogisticsReportClient from '@/components/features/reports/logistics-report-client';
import { getFilteredBookings, getFilterOptions } from '@/app/actions/reports';

interface Props {
  searchParams: { [key: string]: string | undefined };
}

export default async function ReportDataWrapper({ searchParams }: Props) {
  // Await searchParams as it's now a Promise in Next.js 15+
  const params = await searchParams;
  const page = params.page ? parseInt(params.page) : 1;
  const commodity = params.commodity || 'ALL';
  const warehouse = params.warehouse || 'ALL';
  const startDate = params.startDate || '';
  const endDate = params.endDate || '';

  const initialFilters = { page, limit: 20, commodity, warehouse, startDate, endDate };
  
  // Parallel Fetching to prevent waterfall
  const [bookingsRes, optionsRes] = await Promise.all([
    getFilteredBookings(initialFilters),
    getFilterOptions()
  ]);

  return (
    <LogisticsReportClient 
      initialData={bookingsRes.data || []} 
      initialTotalPages={bookingsRes.totalPages || 0}
      initialTotalCount={bookingsRes.totalCount || 0}
      initialOptions={optionsRes} 
      initialFilters={initialFilters} 
    />
  );
}
