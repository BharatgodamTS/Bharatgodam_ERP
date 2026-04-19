import { differenceInDays, startOfDay } from 'date-fns';

export function calculateSettlement(
  inwardDate: string | Date,
  outwardDate: string | Date,
  metricTons: number,
  ratePerMT: number,
  loadingFee: number = 300
) {
  // 1. Duration Logic Layer
  const start = startOfDay(new Date(inwardDate));
  const end = startOfDay(new Date(outwardDate));
  
  // Guarantee absolute minimum of 1 day to prevent Math-by-Zero errors if cargo leaves same day
  const daysStored = Math.max(1, differenceInDays(end, start));
  
  // Ceiling rounding: If they hit 31 days, they get billed for exactly 2 cycles (60 days)
  const billingCycles = Math.ceil(daysStored / 30);

  // 2. Cents/Paise Integer Transformation Matrix
  // Multiplying elements by 100 converts abstract JS decimals into flat secure integers
  const exactStorageCost = (metricTons * ratePerMT * billingCycles);
  const intStorageCost = Math.round(exactStorageCost * 100);
  const intFee = Math.round(loadingFee * 100);
  
  const intSubtotal = intStorageCost + intFee;

  // No Tax Pipeline - GST removed
  
  // Aggregate Secure Integers
  const intGrandTotal = intSubtotal; // No tax added

  // 3. Final Re-conversion to Standard Display Strings (Dividing by 100)
  return {
    daysStored,
    billingCycles,
    rateApplied: ratePerMT,
    baseStorageCost: intStorageCost / 100,
    handlingFee: intFee / 100,
    subtotal: intSubtotal / 100,
    finalTotal: intGrandTotal / 100, // No taxAmount field
  };
}
