import { useParams } from "next/navigation";

/**
 * Check if a value is a valid numeric ID
 */
export function isValidNumericId(x: any): x is string | number {
  if (x === null || x === undefined) return false;
  const s = String(x);
  if (s === "" || s === "undefined" || s === "null" || s === "create")
    return false;
  return !Number.isNaN(Number(s));
}

/**
 * Hook to get numeric evaluation ID from route params
 * Works with both 'evalId' and 'evaluationId' param names
 */
export function useNumericEvalId(): number | null {
  const p = useParams<{ evalId?: string; evaluationId?: string }>();
  const raw = p?.evalId ?? p?.evaluationId;
  return isValidNumericId(raw) ? Number(raw) : null;
}
