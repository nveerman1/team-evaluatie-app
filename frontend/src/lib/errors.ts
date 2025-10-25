// frontend/src/lib/errors.ts
type AnyErr = unknown;

export function errorMsg(err: AnyErr, fallback = "Er ging iets mis") {
  // Probeer bekende plekken te lezen zonder te crashen
  const asAny = err as any;
  const detail =
    asAny?.response?.data?.detail ??
    asAny?.response?.data?.message ??
    asAny?.response?.data?.error ??
    asAny?.message ??
    (typeof err === "string" ? err : null);

  if (!detail) return fallback;

  // Soms is 'detail' een array (FastAPI validation errors)
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (typeof first === "string") return first;
    if (first?.msg) return first.msg;
  }

  if (typeof detail === "string") return detail;
  if (typeof detail === "object" && detail !== null && "msg" in detail) {
    return (detail as any).msg || fallback;
  }

  return fallback;
}
