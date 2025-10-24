import { useState, useEffect } from "react";
import { dashboardService } from "@/services/dashboard.service";
import { toArray } from "@/utils/array.utils";

type Kpis = {
  self_count: number;
  peer_count: number;
  reflection_count: number;
  total_students: number;
};

function computeKpisFromItems(items: any[]): Kpis {
  const total_students = items.length;
  const self_count = items.filter(
    (it) => it.self_avg_overall !== null && it.self_avg_overall !== undefined,
  ).length;
  const peer_count = items.reduce(
    (acc, it) => acc + (Number(it.reviewers_count) || 0),
    0,
  );
  const reflection_count = 0;
  return { self_count, peer_count, reflection_count, total_students };
}

type UiFlag = { type: string; message: string; student?: string };

function flattenFlags(flagResData: any): UiFlag[] {
  const out: UiFlag[] = [];
  const items = toArray<any>(flagResData);
  for (const it of items) {
    const student = it.user_name || it.name || `#${it.user_id ?? "?"}`;
    const fs = Array.isArray(it.flags) ? it.flags : [];
    for (const f of fs) {
      out.push({
        type: f.code || f.severity || "flag",
        message: f.message || JSON.stringify(f),
        student,
      });
    }
  }
  return out;
}

/**
 * Hook to fetch dashboard KPIs and flags for an evaluation
 */
export function useDashboardData(evaluationId: number | null) {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [flags, setFlags] = useState<UiFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setLoading(true);

    if (evaluationId == null) {
      setKpis(null);
      setFlags([]);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [kpiRes, flagRes] = await Promise.all([
          dashboardService.getDashboard(evaluationId),
          dashboardService.getFlags(evaluationId),
          dashboardService.getGradePreview(evaluationId).catch(() => null),
        ]);

        const items = toArray<any>(kpiRes);
        setKpis(computeKpisFromItems(items));
        setFlags(flattenFlags(flagRes));
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      } finally {
        setLoading(false);
      }
    })();
  }, [evaluationId]);

  return { kpis, flags, loading, error };
}
