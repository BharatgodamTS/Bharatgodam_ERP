import { Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { fetchRates } from '@/app/actions/rates';
import RatesDashboard from '@/components/features/rates/rates-dashboard';
import { Loader2, Landmark } from 'lucide-react';

export const metadata = {
  title: 'Rate Master | Logistics ERP',
};

// Generic Skeleton Loaders for massive DB pulls
function RatesTableSkeleton() {
  return (
    <div className="w-full h-80 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center animate-pulse shadow-sm">
      <Loader2 className="w-10 h-10 text-indigo-300 animate-spin mb-4" />
      <span className="text-slate-500 font-bold text-sm uppercase tracking-widest">Synchronizing Master Rates from Cluster...</span>
    </div>
  );
}

// NextJS Server Execution Boundary
async function RatesContainer() {
  // Awaits the auto-pruning execution loop and retrieves fresh values natively
  const ratesData = await fetchRates();
  return <RatesDashboard initialRates={ratesData} />;
}

export default function RateMasterPage() {
  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <Toaster position="top-right" />
      
      <div className="mb-10 pl-1">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center">
          <Landmark className="w-8 h-8 mr-3 text-indigo-600" />
          Commodity Rate Master
        </h1>
        <p className="text-slate-500 mt-2 max-w-3xl text-sm font-medium leading-relaxed">
          Define global standard pricing matrices per Metric Ton (MT). The Billing Engine actively reads these validated timelines to generate live invoice costs for incoming cargo exactly across the seasonal spread while Auto-Expirations are tracked seamlessly.
        </p>
      </div>

      {/* Suspense Wrapper catches the delay and paints the Skeleton while DB works */}
      <Suspense fallback={<RatesTableSkeleton />}>
        <RatesContainer />
      </Suspense>
    </div>
  );
}
