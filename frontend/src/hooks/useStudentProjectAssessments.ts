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
 * Type guard to check if error has axios-like structure with response data
 */
function hasResponseData(error: unknown): error is { response: { data: { detail: unknown } }; message?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response
  );
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
        undefined // Remove status filter - show all assessments for student's teams
      );
      setAssessments(data.items || []);
    } catch (e: unknown) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        // Handle validation errors (422) which may return an array of error objects
        let errorMessage = "Could not load project assessments";
        
        if (hasResponseData(e) && e.response.data.detail) {
          const detail = e.response.data.detail;
          // If detail is an array of validation errors, extract messages
          if (Array.isArray(detail)) {
            const messages = detail
              .map((err: unknown) => {
                // Safely extract msg property from each error object
                if (err && typeof err === "object" && "msg" in err && typeof err.msg === "string") {
                  return err.msg;
                }
                return null;
              })
              .filter((msg): msg is string => msg !== null);
            errorMessage = messages.length > 0 
              ? messages.join(", ")
              : "Validation error occurred";
          } else if (typeof detail === "string") {
            errorMessage = detail;
          } else if (detail && typeof detail === "object") {
            const validationErr = detail as ValidationError;
            errorMessage = validationErr.msg || "An error occurred";
          }
        } else if (typeof e === "object" && e !== null && "message" in e && typeof e.message === "string") {
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
