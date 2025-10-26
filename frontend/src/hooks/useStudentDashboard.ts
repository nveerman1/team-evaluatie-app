"use client";

import { useEffect, useState } from "react";
import { StudentDashboard } from "@/dtos";
import { studentService } from "@/services";

/**
 * Hook to fetch student dashboard data
 */
export function useStudentDashboard() {
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await studentService.getDashboard();
      setDashboard(data);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ||
          e?.message ||
          "Could not load dashboard"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { dashboard, loading, error, refresh };
}
