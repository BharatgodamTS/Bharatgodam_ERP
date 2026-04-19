/**
 * Invoice Formatters
 * Utilities for formatting currency, converting amounts to words, and other display formats
 */

/**
 * Formats a number as Indian Rupees (₹)
 */
export function formatCurrency(amount: number, includeSymbol = true): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return includeSymbol ? `₹ ${formatted}` : formatted;
}

/**
 * Converts numeric amount to Indian rupees in words
 * Example: 3508 => "Rupees Three Thousand Five Hundred Eight Only"
 */
export function amountInWords(num: number): string {
  if (num === 0) return 'Rupees Zero Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Lakh', 'Crore'];

  const convertBelow1000 = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) {
      const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      return teens[n - 10];
    }
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const one = n % 10;
      return ones[one] ? `${tens[ten]} ${ones[one]}` : tens[ten];
    }
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    return remainder ? `${ones[hundred]} Hundred ${convertBelow1000(remainder)}` : `${ones[hundred]} Hundred`;
  };

  let words = '';
  let scaleIndex = 0;

  while (num > 0) {
    const groupOfThree = num % 1000;
    if (groupOfThree > 0) {
      const groupWords = convertBelow1000(groupOfThree);
      const scale = scales[scaleIndex];
      words = `${groupWords} ${scale} ${words}`.trim();
    }
    num = Math.floor(num / 1000);
    scaleIndex++;
  }

  return `Rupees ${words.trim()} Only`;
}

/**
 * Formats a date string from DD/MM/YYYY format
 */
export function formatDate(dateString: string): string {
  try {
    const [day, month, year] = dateString.split('/');
    const date = new Date(`${year}-${month}-${day}`);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: '2-digit' });
  } catch {
    return dateString;
  }
}

/**
 * Formats a number with thousand separators (Indian style)
 */
export function formatNumber(num: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Rounds to nearest rupee
 */
export function roundToNearestRupee(amount: number): { rounded: number; roundOff: number } {
  const rounded = Math.round(amount);
  return {
    rounded,
    roundOff: rounded - amount,
  };
}
