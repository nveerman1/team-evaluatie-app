"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type UrlState = {
  q: string;
  status: string;
  course_id: string;
  setParams: (
    p: Partial<{ q: string; status: string; course_id: string }>,
  ) => void;
};

export function useUrlState(): UrlState {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const q = sp.get("q") ?? "";
  const status = sp.get("status") ?? "";
  const course_id = sp.get("course_id") ?? "";

  const setParams = useCallback(
    (update: Partial<{ q: string; status: string; course_id: string }>) => {
      const current = new URLSearchParams(sp?.toString() ?? "");
      const entries = Object.entries(update) as [string, string | undefined][];
      for (const [key, val] of entries) {
        if (val == null) continue;
        const trimmed = typeof val === "string" ? val.trim() : val;
        if (trimmed === "") current.delete(key);
        else current.set(key, String(trimmed));
      }
      const search = current.toString();
      const next = search ? `${pathname}?${search}` : pathname;
      router.replace(next);
    },
    [router, pathname, sp],
  );

  return useMemo(
    () => ({ q, status, course_id, setParams }),
    [q, status, course_id, setParams],
  );
}

export default useUrlState;
