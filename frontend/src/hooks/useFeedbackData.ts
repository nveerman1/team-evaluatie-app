"use client";

import { useState, useEffect, useCallback } from "react";
import { peerEvaluationOverviewService } from "@/services/peer-evaluation-overview.service";
import type {
  FeedbackItem,
} from "@/services/peer-evaluation-overview.service";

export type { FeedbackItem };

export type FeedbackFilters = {
  courseId?: number;
  projectId?: number;
  evaluationIds?: number[];
  category?: string;
  sentiment?: string;
  searchText?: string;
  riskOnly?: boolean;
};

export type FeedbackData = {
  feedbackItems: FeedbackItem[];
  totalCount: number;
};

export function useFeedbackData(filters?: FeedbackFilters) {
  const [data, setData] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await peerEvaluationOverviewService.getFeedback(filters);
      setData(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feedback data");
    } finally {
      setLoading(false);
    }
  }, [filters?.courseId, filters?.projectId, filters?.category, filters?.sentiment, filters?.searchText, filters?.riskOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
