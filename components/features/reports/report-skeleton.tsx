import React from 'react';

const ReportSkeleton = () => {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Filter Bar Skeleton */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div className="h-10 w-64 bg-slate-200 rounded-md"></div>
        <div className="h-10 w-40 bg-slate-200 rounded-md"></div>
        <div className="h-10 w-40 bg-slate-200 rounded-md"></div>
        <div className="h-10 w-32 bg-slate-200 rounded-md ml-auto"></div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="h-12 bg-slate-100 border-b border-slate-200"></div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-16 border-b border-slate-100 flex items-center px-4 gap-4">
            <div className="h-4 w-8 bg-slate-100 rounded"></div>
            <div className="h-4 w-24 bg-slate-100 rounded"></div>
            <div className="h-4 w-32 bg-slate-100 rounded"></div>
            <div className="h-4 w-20 bg-slate-100 rounded"></div>
            <div className="h-4 w-40 bg-slate-100 rounded"></div>
            <div className="h-4 w-16 bg-slate-100 rounded ml-auto"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportSkeleton;
