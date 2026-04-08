import React, { Suspense } from 'react';
import ReportDataWrapper from './report-data-wrapper';
import ReportSkeleton from '@/components/features/reports/report-skeleton';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'Logistics Reports | WMS Pro',
  description: 'Aggregated warehouse bookings and movement history.',
};

export default function ReportsPage({ searchParams }: { searchParams: { [key: string]: string | undefined } }) {
  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 py-8 md:px-0">
      <Toaster position="top-right" />
      <Suspense fallback={<ReportSkeleton />}>
        <ReportDataWrapper searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
