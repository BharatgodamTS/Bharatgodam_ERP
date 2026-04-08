/**
 * Pro-Rata Warehouse Storage Pricing Engine
 *
 * Formula: (Weight_MT × Rate_per_MT_per_month × Days) / 30
 *
 * The commodity rate is expressed as ₹/MT/month. Storage is billed
 * pro-rata on a 30-day standard month:
 *
 *   10 MT of Rice @ ₹90/MT/month for 20 days:
 *   = (10 × 90 × 20) / 30
 *   = ₹600.00 (no GST - total remains ₹600.00)
 *
 * Floating-point safety:
 *   All arithmetic is done in paise (× 100) and rounded via Math.round()
 *   at the final step, eliminating 0.9999... drift entirely.
 */

import { differenceInDays } from 'date-fns';

const DAYS_PER_MONTH = 30;  // Standard billing month

/**
 * Strip the time component from a date string so that day-difference
 * math always works in whole calendar days (Asia/Kolkata local midnight).
 * Handles both "YYYY-MM-DD" strings and full ISO timestamps.
 */
function toCalendarDay(date: string | Date): Date {
  const raw = typeof date === 'string' ? date : date.toISOString();
  // Take only the YYYY-MM-DD portion — avoids all timezone offset issues
  const datePart = raw.slice(0, 10); // "2026-04-01"
  return new Date(datePart + 'T00:00:00.000Z');
}

export interface RentBreakdown {
  totalDays:    number;   // Exact calendar days stored (minimum 1)
  weightMT:     number;   // MT at time of booking
  appliedRate:  number;   // ₹/MT/month from Rate Master
  monthlyRent:  number;   // weight × rate (cost for a full 30-day month)
  dailyRate:    number;   // monthlyRent ÷ 30
  storageRent:  number;   // dailyRate × totalDays (final total - no tax)
  totalAmount:  number;   // storageRent (no tax added)
}

/**
 * calculateRent — Pro-rata storage rent.
 *
 * @param weightMT     - Metric tons stored
 * @param ratePerMonth - Monthly rate in ₹/MT (from Rate Master or Commodity Master)
 * @param inwardDate   - Date cargo entered warehouse
 * @param outwardDate  - Date cargo was (or will be) removed
 */
export function calculateRent(
  weightMT:     number,
  ratePerMonth: number,
  inwardDate:   string | Date,
  outwardDate:  string | Date,
): RentBreakdown {
  // ── 1. Calendar Day Normalization ────────────────────────────────────────
  const start = toCalendarDay(inwardDate);
  const end   = toCalendarDay(outwardDate);

  // Same-day pickup = 1 day minimum billed (protects against 0)
  const rawDays  = differenceInDays(end, start);
  const totalDays = Math.max(1, rawDays);

  // ── 2. Paise-Level Integer Math ──────────────────────────────────────────
  // Scale all money values by 100 before multiplication to avoid JS
  // floating-point accumulation. Final step divides back to rupees.

  // monthlyRent in paise: weight × rate × 100
  // (kept as rupees here for readability — actual paise conversion is below)
  const monthlyRent = (Math.round(weightMT * 100) / 100) *
                      (Math.round(ratePerMonth * 100) / 100);

  // Work entirely in paise from here
  const monthlyPaise  = Math.round(monthlyRent * 100);
  const dailyPaise    = monthlyPaise / DAYS_PER_MONTH;           // exact division
  const rentPaise     = Math.round(dailyPaise * totalDays);      // rounded integer
  const totalPaise    = rentPaise; // No GST - total equals storage rent

  // ── 3. Convert Back to Rupees ────────────────────────────────────────────
  const storageRent = rentPaise / 100;
  const totalAmount = totalPaise / 100;
  const dailyRate   = Math.round(dailyPaise) / 100;

  return {
    totalDays,
    weightMT,
    appliedRate: ratePerMonth,
    monthlyRent: Math.round(monthlyRent * 100) / 100,
    dailyRate,
    storageRent,
    totalAmount, // No gstAmount field
  };
}

/**
 * Legacy shim — keeps calculateInvoiceTotal() working for any callers
 * that haven't migrated to calculateRent() yet.
 * @deprecated Use calculateRent() directly for new code.
 */
export function calculateInvoiceTotal(
  startDate:      string | Date,
  endDate:        string | Date,
  spaceRequested: number,
  ratePerSqFt:    number,
) {
  const r = calculateRent(spaceRequested, ratePerSqFt, startDate, endDate);
  return {
    durationDays: r.totalDays,
    rateApplied:  r.appliedRate,
    subtotal:     r.storageRent,
    totalAmount:  r.totalAmount, // No taxAmount field
  };
}
