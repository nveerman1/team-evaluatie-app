"use client";

import { useEffect, useState } from "react";
import { ApiAuthError } from "@/lib/api";
import { ProjectAssessmentListItem } from "@/dtos";
import { projectAssessmentService } from "@/services";

/**
 * FastAPI validation error structure
 */
interface ValidationError {
  type?: string;
  loc?: (string | number)[];
  msg?: string;
  input?: unknown;
}

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
    } catch (e: unknown) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        // Handle validation errors (422) which may return an array of error objects
        let errorMessage = "Could not load project assessments";
        
        const axiosError = e as { response?: { data?: { detail?: unknown } }; message?: string };
        
        if (axiosError?.response?.data?.detail) {
          const detail = axiosError.response.data.detail;
          // If detail is an array of validation errors, extract messages
          if (Array.isArray(detail)) {
            const messages = detail
              .map((err: ValidationError) => err.msg || "Validation error")
              .filter(Boolean);
            errorMessage = messages.length > 0 
              ? messages.join(", ")
              : "Validation error occurred";
          } else if (typeof detail === "string") {
            errorMessage = detail;
          } else if (detail && typeof detail === "object") {
            const validationErr = detail as ValidationError;
            errorMessage = validationErr.msg || "An error occurred";
          }
        } else if (axiosError?.message) {
          errorMessage = axiosError.message;
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
