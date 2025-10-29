"use client";

import { useEffect, useState } from "react";
import { ProjectAssessmentListItem } from "@/dtos";
import { projectAssessmentService } from "@/services";

/**
 * Hook to fetch student's project assessments
 */
export function useStudentProjectAssessments() {
  const [assessments, setAssessments] = useState<ProjectAssessmentListItem[]>(
    []
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await projectAssessmentService.getProjectAssessments(
        undefined,
        "published"
      );
      setAssessments(data.items || []);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ||
          e?.message ||
          "Could not load project assessments"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { assessments, loading, error, refresh };
}
