"use client";

import { useEffect, useState } from "react";
import type { Evaluation } from "@/dtos/evaluation.dto";
import { evaluationService } from "@/services";

type UseEvaluationsArgs = {
  query?: string;
  status?: string;
  course_id?: number;
};

export function useEvaluations(filters?: UseEvaluationsArgs) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { query, status, course_id } = filters ?? {};

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await evaluationService.getEvaluations({
          q: query?.trim() ? query.trim() : undefined,
          status: status?.trim() ? status.trim() : undefined,
          course_id: course_id,
        });
        if (!mounted) return;
        setEvaluations(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!mounted) return;
        setError(
          e?.response?.data?.detail ||
            e?.message ||
            "Kon evaluaties niet ophalen",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [query, status, course_id]);

  return { evaluations, loading, error, setEvaluations };
}

export default useEvaluations;
