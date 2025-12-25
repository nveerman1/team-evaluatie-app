"use client";

import { useState, useEffect, useCallback } from "react";
import { peerEvaluationOverviewService } from "@/services/peer-evaluation-overview.service";
import type { TeacherFeedbackResponse } from "@/services/peer-evaluation-overview.service";

export type TeacherFeedbackFilters = {
  courseId?: number;
  projectId?: number;
};

export function useTeacherFeedback(filters?: TeacherFeedbackFilters) {
  const [data, setData] = useState<TeacherFeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await peerEvaluationOverviewService.getTeacherFeedback(filters);
      setData(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load teacher feedback");
    } finally {
      setLoading(false);
    }
  }, [filters?.courseId, filters?.projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
