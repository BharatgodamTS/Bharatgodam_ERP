/**
 * Revenue Distribution Engine for WMS Pro
 * Calculates equity splits between Warehouse Owners and Platform Operators
 */

export interface DistributionInput {
  totalRevenuePaise: number; // Revenue in paise (smallest currency unit)
  ownerEquityPercent: number; // Owner's equity percentage (e.g., 60)
}

export interface DistributionResult {
  totalRevenue: number; // Total revenue in rupees
  ownerShare: number; // Owner's share in rupees
  operatorShare: number; // Operator's share in rupees
  ownerSharePaise: number; // Owner's share in paise
  operatorSharePaise: number; // Operator's share in paise
}

/**
 * Calculates revenue distribution using integer math to avoid rounding errors
 * @param input Distribution parameters
 * @returns Distribution result with paise and rupee amounts
 */
export function calculateDistribution(input: DistributionInput): DistributionResult {
  const { totalRevenuePaise, ownerEquityPercent } = input;

  // Calculate owner's share in paise using integer math
  const ownerSharePaise = Math.floor((totalRevenuePaise * ownerEquityPercent) / 100);

  // Operator's share is the remainder (ensures no paise is lost)
  const operatorSharePaise = totalRevenuePaise - ownerSharePaise;

  // Convert to rupees for display
  const totalRevenue = totalRevenuePaise / 100;
  const ownerShare = ownerSharePaise / 100;
  const operatorShare = operatorSharePaise / 100;

  return {
    totalRevenue,
    ownerShare,
    operatorShare,
    ownerSharePaise,
    operatorSharePaise,
  };
}

/**
 * Formats currency amount to Indian Rupee format
 * @param amount Amount in rupees
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats large numbers with Indian numbering system
 * @param num Number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}