"use client";

import { useState, useEffect, useCallback } from "react";
import { peerEvaluationOverviewService } from "@/services/peer-evaluation-overview.service";
import type {
  AggregatedFeedbackItem,
} from "@/services/peer-evaluation-overview.service";

export type { AggregatedFeedbackItem };

export type AggregatedFeedbackFilters = {
  courseId?: number;
  projectId?: number;
  evaluationId?: number;
};

export type AggregatedFeedbackData = {
  feedbackItems: AggregatedFeedbackItem[];
  totalCount: number;
};

export function useAggregatedFeedback(filters?: AggregatedFeedbackFilters) {
  const [data, setData] = useState<AggregatedFeedbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await peerEvaluationOverviewService.getAggregatedFeedback(filters);
      setData(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load aggregated feedback");
    } finally {
      setLoading(false);
    }
  }, [filters?.courseId, filters?.projectId, filters?.evaluationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
