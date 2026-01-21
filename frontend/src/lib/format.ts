/**
 * Format utilities for consistent data presentation
 */

/**
 * Formats a number with a sign (+/-) and 1 decimal place.
 * Returns "–" for null, undefined, NaN, or Infinity values.
 * 
 * @param value - The number to format (can be null or undefined)
 * @returns Formatted string with sign and 1 decimal place, or "–" if invalid
 * 
 * @example
 * formatSigned1dp(1.25)     // "+1.3"
 * formatSigned1dp(-1.21)    // "-1.2"
 * formatSigned1dp(0)        // "0.0"
 * formatSigned1dp(0.04)     // "+0.0"
 * formatSigned1dp(null)     // "–"
 * formatSigned1dp(undefined)// "–"
 * formatSigned1dp(NaN)      // "–"
 */
export function formatSigned1dp(value: number | null | undefined): string {
  // Check if value is a valid finite number
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "–";
  }

  // Format with 1 decimal place and add sign if positive
  const formatted = value.toFixed(1);
  return value > 0 ? `+${formatted}` : formatted;
}
