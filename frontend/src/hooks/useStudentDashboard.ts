"use client";

import { useEffect, useState } from "react";
import { StudentDashboard } from "@/dtos";
import { studentService } from "@/services";
import { ApiAuthError } from "@/lib/api";

/**
 * Hook to fetch student dashboard data
 * Handles ApiAuthError gracefully for business cases (e.g., 403 no self-assessment)
 */
export function useStudentDashboard() {
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSelfAssessment, setNeedsSelfAssessment] = useState<boolean>(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    setNeedsSelfAssessment(false);
    try {
      const data = await studentService.getDashboard();
      setDashboard(data);
      setNeedsSelfAssessment(data.needsSelfAssessment);
    } catch (e: any) {
      // Handle ApiAuthError with friendly message
      if (e instanceof ApiAuthError) {
        setError(e.friendlyMessage);
        // For 401, the UI might want to redirect to /login
        // For 403, getDashboard already handled the business case
      } else {
        setError(
          e?.response?.data?.detail ||
            e?.message ||
            "Could not load dashboard"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { dashboard, loading, error, needsSelfAssessment, refresh };
}
