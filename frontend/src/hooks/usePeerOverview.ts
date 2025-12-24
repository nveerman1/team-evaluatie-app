"use client";

import { useState, useEffect, useCallback } from "react";
import { peerEvaluationOverviewService } from "@/services/peer-evaluation-overview.service";
import type {
  OmzaTrendDataPoint,
  StudentHeatmapRow,
  KpiData,
} from "@/services/peer-evaluation-overview.service";

export type { OmzaTrendDataPoint, StudentHeatmapRow, KpiData };

export type KpiStudent = {
  student_id: number;
  student_name: string;
  value: number;
};

export type PeerOverviewFilters = {
  courseId?: number;
  projectId?: number;
  period?: "3months" | "6months" | "year";
  studentName?: string;
  evaluationIds?: number[];
};

export type PeerOverviewData = {
  trendData: OmzaTrendDataPoint[];
  heatmapData: StudentHeatmapRow[];
  kpiData: KpiData;
};

export function usePeerOverview(filters?: PeerOverviewFilters) {
  const [data, setData] = useState<PeerOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await peerEvaluationOverviewService.getDashboard(filters);
      setData(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load peer overview data");
    } finally {
      setLoading(false);
    }
  }, [filters?.studentName, filters?.courseId, filters?.projectId, filters?.period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
