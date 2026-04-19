/**
 * Currency formatting utility for Indian Rupee (INR).
 *
 * Uses the `en-IN` locale which correctly formats numbers with the Indian
 * numbering system (Lakhs/Crores) and the ₹ prefix:
 *   formatCurrency(1250.5)   → "₹1,250.50"
 *   formatCurrency(100000)   → "₹1,00,000.00"
 *   formatCurrency(1500000)  → "₹15,00,000.00"
 *
 * Note for @react-pdf/renderer: The ₹ symbol (U+20B9) is supported by the
 * built-in Helvetica font ONLY in newer versions of @react-pdf/renderer (≥3.x).
 * If the symbol renders as "?" in PDFs, the `pdfCurrency()` fallback below
 * uses "Rs." which is universally safe with all font stacks.
 */
const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

/**
 * Format a number as Indian Rupee currency for Web UI display.
 * Example: formatCurrency(1250.5) → "₹1,250.50"
 */
export function formatCurrency(amount: number | undefined | null): string {
  if (amount == null || isNaN(amount)) return '₹0.00';
  return formatter.format(amount);
}

/**
 * Format a number as Indian Rupee for PDF generation.
 * Uses "Rs." prefix instead of "₹" for maximum font compatibility
 * with @react-pdf/renderer's built-in Helvetica font stack.
 * Switch to formatCurrency() if you embed a custom Unicode font.
 */
export function pdfCurrency(amount: number | undefined | null): string {
  if (amount == null || isNaN(amount)) return 'Rs. 0.00';
  const formatted = formatter.format(amount);
  // Replace "₹" with "Rs." for PDF safety with Helvetica
  return formatted.replace('₹', 'Rs. ');
}
