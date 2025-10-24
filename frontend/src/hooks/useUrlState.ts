import { useSearchParams, useRouter, usePathname } from "next/navigation";

/**
 * Hook to manage URL search parameters with type-safe setter
 */
export function useUrlState() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const query = sp.get("q") ?? "";
  const status = sp.get("status") ?? "";
  const courseId = sp.get("course_id") ?? "";

  function setParams(next: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(sp.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (v === undefined || v === "") params.delete(k);
      else params.set(k, String(v));
    });
    router.replace(`${pathname}?${params.toString()}`);
  }

  return { query, status, courseId, setParams };
}
