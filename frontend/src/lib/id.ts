import { useParams } from "next/navigation";

export function isValidNumericId(x: any): x is string | number {
  if (x === null || x === undefined) return false;
  const s = String(x);
  if (s === "" || s === "undefined" || s === "null" || s === "create")
    return false;
  return !Number.isNaN(Number(s));
}

export function useNumericEvalId(): number | null {
  // in sommige routes is het param 'evalId', in andere 'evaluationId'
  const p = useParams<{ evalId?: string; evaluationId?: string }>();
  const raw = p?.evalId ?? p?.evaluationId;
  return isValidNumericId(raw) ? Number(raw) : null;
}
