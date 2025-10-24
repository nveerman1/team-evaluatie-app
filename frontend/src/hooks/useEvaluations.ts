import { useState, useEffect } from "react";
import { evaluationService } from "@/services/evaluation.service";
import { Evaluation } from "@/dtos/evaluation.dto";

/**
 * Hook to fetch and manage evaluations list
 */
export function useEvaluations(filters?: {
  query?: string;
  status?: string;
  courseId?: string;
}) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    evaluationService
      .getEvaluations({
        q: filters?.query,
        status: filters?.status,
        course_id: filters?.courseId,
      })
      .then((data) => setEvaluations(data))
      .catch((e) => setError(e?.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [filters?.query, filters?.status, filters?.courseId]);

  return { evaluations, loading, error, setEvaluations };
}
