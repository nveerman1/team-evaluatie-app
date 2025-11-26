"use client";

import { useEffect, useState, useCallback } from "react";
import { StudentGrowthData } from "@/dtos";
import { studentService } from "@/services";
import { ApiAuthError } from "@/lib/api";

/**
 * Hook to fetch student growth data for the growth page
 * Handles loading, error, and refetch states
 */
export function useStudentGrowth() {
  const [data, setData] = useState<StudentGrowthData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  const fetchGrowthData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const growthData = await studentService.getGrowthData();
      setData(growthData);
    } catch (e: unknown) {
      if (e instanceof ApiAuthError) {
        setError(e.friendlyMessage);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Kon groei-data niet laden");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    fetchGrowthData();
  }, [fetchGrowthData]);

  const regenerateSummary = useCallback(async () => {
    setIsRegenerating(true);
    try {
      const result = await studentService.regenerateGrowthSummary();
      setData((prev) =>
        prev ? { ...prev, ai_summary: result.ai_summary } : prev
      );
    } catch (e: unknown) {
      if (e instanceof ApiAuthError) {
        setError(e.friendlyMessage);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Kon samenvatting niet genereren");
      }
    } finally {
      setIsRegenerating(false);
    }
  }, []);

  useEffect(() => {
    fetchGrowthData();
  }, [fetchGrowthData]);

  return {
    data,
    isLoading,
    error,
    refetch,
    regenerateSummary,
    isRegenerating,
  };
}
