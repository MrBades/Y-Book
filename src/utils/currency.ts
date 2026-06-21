/**
 * Formats a numeric value or numeric string into a beautifully styled Naira (₦) currency format.
 * Includes consistent comma grouping representation and adjustable decimal precision.
 * 
 * @param amount The numeric amount or string to format.
 * @param forceDecimals Specify if we want to force two decimal places (defaults to true).
 * @returns A formatted string prefixed with the ₦ sign.
 */
export function formatNaira(amount: number | string | null | undefined, forceDecimals: boolean = true): string {
  if (amount === null || amount === undefined) {
    return '₦0.00';
  }

  // Convert string input to float securely
  const numericValue = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numericValue)) {
    return '₦0.00';
  }

  const fractionDigits = forceDecimals ? 2 : (numericValue % 1 === 0 ? 0 : 2);

  const formattedAmount = numericValue.toLocaleString('en-NG', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  return `₦${formattedAmount}`;
}
