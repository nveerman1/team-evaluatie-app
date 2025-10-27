"use client";

import { useEffect, useState } from "react";
import { StudentResult } from "@/dtos";
import { studentService } from "@/services";

/**
 * Hook to fetch student results
 */
export function useStudentResults(userId: number) {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await studentService.getAllResults(userId);
      setResults(data);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ||
          e?.message ||
          "Could not load results"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      refresh();
    }
  }, [userId]);

  return { results, loading, error, refresh };
}
