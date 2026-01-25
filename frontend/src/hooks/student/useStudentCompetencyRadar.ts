"use client";

import { useEffect, useState } from "react";
import { fetchWithErrorHandling } from "@/lib/api";

export interface ScanListItem {
  id: string;
  title: string;
  date: string;
  type: string;
}

export interface RadarCategoryScore {
  category_id: number;
  category_name: string;
  average_score: number | null;
  count: number;
}

export interface ScanRadarData {
  scan_id: string;
  scan_label: string;
  created_at: string;
  categories: RadarCategoryScore[];
  overall_avg?: number;
}

/**
 * Hook to fetch list of student's competency scans
 */
export function useStudentCompetencyScans() {
  const [data, setData] = useState<ScanListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchScans = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchWithErrorHandling("/api/v1/student/competency/scans");
        const data = await response.json();
        if (isMounted) {
          setData(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error("Failed to fetch scans"));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchScans();

    return () => {
      isMounted = false;
    };
  }, []);

  return { data, isLoading, isError: error !== null, error };
}

/**
 * Hook to fetch radar data for a specific scan
 */
export function useStudentCompetencyRadar(scanId: string | null) {
  const [data, setData] = useState<ScanRadarData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!scanId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchRadarData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchWithErrorHandling(
          `/api/v1/student/competency/scans/${scanId}/radar`
        );
        const data = await response.json();
        if (isMounted) {
          setData(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error("Failed to fetch radar data"));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRadarData();

    return () => {
      isMounted = false;
    };
  }, [scanId]);

  return { data, isLoading, isError: error !== null, error };
}
