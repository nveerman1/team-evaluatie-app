"use client";

import { useEffect, useState, useCallback } from "react";
import { competencyMonitorService } from "@/services/competency-monitor.service";
import type {
  CompetencyOverviewData,
  CategoryDetailData,
  StudentCompetencySummary,
  LearningGoalSummary,
  ReflectionSummary,
  CompetencyOverviewFilters,
  FilterOptions,
} from "@/dtos/competency-monitor.dto";

/**
 * Hook to fetch competency overview data for the teacher dashboard
 */
export function useCompetencyOverview(filters?: CompetencyOverviewFilters) {
  const [data, setData] = useState<CompetencyOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await competencyMonitorService.getOverview(filters);
      setData(result);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail || err?.message || "Kon overzicht niet laden");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

/**
 * Hook to fetch category detail data
 */
export function useCategoryDetail(categoryId: number | null, filters?: CompetencyOverviewFilters) {
  const [data, setData] = useState<CategoryDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!categoryId) {
      setData(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const result = await competencyMonitorService.getCategoryDetail(categoryId, filters);
      setData(result);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail || err?.message || "Kon categorie details niet laden");
    } finally {
      setLoading(false);
    }
  }, [categoryId, filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

/**
 * Hook to fetch students list
 */
export function useCompetencyStudents(filters?: CompetencyOverviewFilters) {
  const [data, setData] = useState<StudentCompetencySummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await competencyMonitorService.getStudents(filters);
      setData(result);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail || err?.message || "Kon leerlingen niet laden");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

/**
 * Hook to fetch learning goals
 */
export function useCompetencyLearningGoals(filters?: CompetencyOverviewFilters) {
  const [data, setData] = useState<LearningGoalSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await competencyMonitorService.getLearningGoals(filters);
      setData(result);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail || err?.message || "Kon leerdoelen niet laden");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

/**
 * Hook to fetch reflections
 */
export function useCompetencyReflections(filters?: CompetencyOverviewFilters) {
  const [data, setData] = useState<ReflectionSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await competencyMonitorService.getReflections(filters);
      setData(result);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail || err?.message || "Kon reflecties niet laden");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

/**
 * Hook to fetch filter options
 */
export function useCompetencyFilterOptions() {
  const [data, setData] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await competencyMonitorService.getFilterOptions();
      setData(result);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail || err?.message || "Kon filteropties niet laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
