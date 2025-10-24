/**
 * Convert any value to an array
 * Handles both direct arrays and objects with an 'items' property
 */
export function toArray<T = any>(x: any): T[] {
  if (Array.isArray(x)) return x;
  if (x?.items && Array.isArray(x.items)) return x.items;
  return [];
}

/**
 * Format a date string to locale date string
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return "—";
  }
}
