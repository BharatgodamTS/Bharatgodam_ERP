import RevenueDistributionSocketClient from '@/components/features/revenue-distribution/revenue-distribution-socket-client';

export const metadata = {
  title: 'Revenue Distribution | WMS Pro',
  description: 'Live warehouse revenue distribution dashboard with real-time updates.',
};

export default function RevenueDistributionPage() {
  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 py-8 md:px-0">
      <RevenueDistributionSocketClient />
    </div>
  );
}
