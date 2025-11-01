"use client";

import { useEffect, useState } from "react";
import { ApiAuthError } from "@/lib/api";
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
        undefined,
        "published"
      );
      setAssessments(data.items || []);
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        // Handle validation errors (422) which may return an array of error objects
        let errorMessage = "Could not load project assessments";
        
        if (e?.response?.data?.detail) {
          const detail = e.response.data.detail;
          // If detail is an array of validation errors, extract messages
          if (Array.isArray(detail)) {
            errorMessage = detail
              .map((err: any) => err.msg || JSON.stringify(err))
              .join(", ");
          } else if (typeof detail === "string") {
            errorMessage = detail;
          } else if (typeof detail === "object") {
            errorMessage = detail.msg || JSON.stringify(detail);
          }
        } else if (e?.message) {
          errorMessage = e.message;
        }
        
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { assessments, loading, error, refresh };
}
