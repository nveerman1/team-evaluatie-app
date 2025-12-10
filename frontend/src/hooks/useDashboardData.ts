"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { errorMsg } from "@/lib/errors";
import { dashboardService } from "@/services/dashboard.service";
import {
  StudentProgressResponse,
  StudentProgressKPIs,
} from "@/dtos/dashboard.dto";

/** Shapes afgeleid van jouw routers (dashboard.py, flags.py, grades.py) */
type CriterionBreakdown = {
  criterion_id: number;
  peer_avg: number;
  peer_count: number;
  self_score?: number | null;
};

type DashboardRow = {
  user_id: number;
  user_name: string;
  peer_avg_overall: number;
  self_avg_overall?: number | null;
  reviewers_count: number;
  gcf: number;
  spr: number;
  suggested_grade: number;
  breakdown?: CriterionBreakdown[];
};

type DashboardResponse = {
  evaluation_id: number;
  rubric_id: number;
  rubric_scale_min: number;
  rubric_scale_max: number;
  criteria: { id: number; name: string; weight: number }[];
  items: DashboardRow[];
};

type Flag = {
  code: string;
  severity: "low" | "medium" | "high";
  message: string;
  meta?: Record<string, number>;
};

type FlagRow = {
  user_id: number;
  user_name: string;
  peer_avg_overall: number;
  self_avg_overall?: number | null;
  reviewers_count: number;
  gcf: number;
  spr: number;
  flags: Flag[];
};

type FlagsResponse = {
  evaluation_id: number;
  items: FlagRow[];
};

type GradePreviewItem = {
  user_id: number;
  user_name: string;
  avg_score: number;
  gcf: number;
  spr: number;
  suggested_grade: number;
  team_number?: number | null;
  class_name?: string | null;
};

type GradePreviewResponse = {
  evaluation_id: number;
  items: GradePreviewItem[];
};

type DashboardState = {
  loading: boolean;
  error: string | null;

  dashboard: DashboardResponse | null;
  /** Array i.p.v. full response, zodat page.tsx gewoon flags.map(...) kan doen */
  flags: FlagRow[];
  preview: GradePreviewResponse | null;
  studentProgress: StudentProgressResponse | null;

  kpis: {
    students_total: number;
    reviewers_total: number;
    selfreviews_present: number;
    reflections_count: number;
  };

  refresh: () => void;
};

export function useDashboardData(evaluationId?: number): DashboardState {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [flagsArr, setFlagsArr] = useState<FlagRow[]>([]);
  const [preview, setPreview] = useState<GradePreviewResponse | null>(null);
  const [studentProgress, setStudentProgress] =
    useState<StudentProgressResponse | null>(null);
  const [kpisData, setKpisData] = useState<StudentProgressKPIs | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchAll = useCallback(async (id: number, signal?: AbortSignal) => {
    setLoading(true);
    setErr(null);
    try {
      const [dash, flagsRes, prv, progress, kpis] = await Promise.all([
        dashboardService.getDashboard(id, true, signal), // include_breakdown=true
        dashboardService.getFlags(id, signal),
        dashboardService.getGradePreview(id, signal),
        dashboardService.getStudentProgress(id, signal),
        dashboardService.getKPIs(id, signal),
      ]);

      setDashboard(dash as DashboardResponse);
      setFlagsArr(((flagsRes as FlagsResponse)?.items ?? []) as FlagRow[]);
      setPreview(prv as GradePreviewResponse);
      setStudentProgress(progress);
      setKpisData(kpis);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setErr(errorMsg(e, "Ophalen van dashboarddata mislukte"));
        setDashboard(null);
        setFlagsArr([]);
        setPreview(null);
        setStudentProgress(null);
        setKpisData(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!evaluationId) {
      setLoading(false);
      setErr("Geen evaluationId");
      setDashboard(null);
      setFlagsArr([]);
      setPreview(null);
      setStudentProgress(null);
      setKpisData(null);
      return;
    }
    
    const controller = new AbortController();
    void fetchAll(evaluationId, controller.signal);
    
    return () => controller.abort();
  }, [evaluationId, fetchAll]);

  const kpis = useMemo(() => {
    if (kpisData) {
      return {
        students_total: kpisData.total_students,
        reviewers_total: kpisData.peer_reviews_total,
        selfreviews_present: kpisData.self_reviews_completed,
        reflections_count: kpisData.reflections_completed,
      };
    }
    // Fallback to old calculation if KPIs not available
    const rows = dashboard?.items ?? [];
    const students_total = rows.length;
    const reviewers_total = rows.reduce(
      (acc, r) =>
        acc + (Number.isFinite(r.reviewers_count) ? r.reviewers_count : 0),
      0,
    );
    const selfreviews_present = rows.reduce(
      (acc, r) => acc + (r.self_avg_overall != null ? 1 : 0),
      0,
    );
    const reflections_count = 0;
    return {
      students_total,
      reviewers_total,
      selfreviews_present,
      reflections_count,
    };
  }, [dashboard, kpisData]);

  const refresh = useCallback(() => {
    if (evaluationId) {
      const controller = new AbortController();
      void fetchAll(evaluationId, controller.signal);
      return () => controller.abort();
    }
  }, [evaluationId, fetchAll]);

  return {
    loading,
    error: err,
    dashboard,
    flags: flagsArr, // ← array
    preview,
    studentProgress,
    kpis,
    refresh,
  };
}
