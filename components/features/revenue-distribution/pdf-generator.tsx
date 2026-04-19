import { RevenueDistributionData } from '@/lib/revenue-types';

// PDF generation is disabled in this build because @react-pdf/renderer is not installed.
// Use a server-side PDF endpoint or install the missing dependency to restore this feature.

export async function generateDistributionReport(data: RevenueDistributionData): Promise<void> {
  console.warn('generateDistributionReport called, but PDF generation is disabled.', data);
  throw new Error('PDF generation is not available in this build.');
}
