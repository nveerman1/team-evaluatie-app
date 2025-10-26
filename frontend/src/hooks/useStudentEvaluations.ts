"use client";

import { useEffect, useState } from "react";
import { StudentEvaluation } from "@/dtos";
import { studentService } from "@/services";

/**
 * Hook to fetch student's evaluations
 */
export function useStudentEvaluations() {
  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await studentService.getMyEvaluations();
      setEvaluations(data);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ||
          e?.message ||
          "Could not load evaluations"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { evaluations, loading, error, refresh };
}
