import { useState, useEffect } from "react";
import { peerEvaluationOverviewService, type ReflectionResponse } from "@/services/peer-evaluation-overview.service";

export type ReflectionFilters = {
  courseId?: number;
  projectId?: number;
  studentName?: string;
};

export function useReflections(filters?: ReflectionFilters) {
  const [data, setData] = useState<ReflectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const result = await peerEvaluationOverviewService.getReflections(filters);
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [filters?.courseId, filters?.projectId, filters?.studentName]);

  return { data, loading, error };
}
