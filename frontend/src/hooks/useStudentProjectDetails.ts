"use client";

import { useEffect, useState } from "react";
import { ProjectAssessmentDetailOut } from "@/dtos";
import { projectAssessmentService } from "@/services";

/**
 * Hook to fetch detailed project assessment data including scores and grades
 * for multiple assessments
 */
export function useStudentProjectDetails(assessmentIds: number[]) {
  const [details, setDetails] = useState<Map<number, ProjectAssessmentDetailOut>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      if (assessmentIds.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        // Fetch all assessment details in parallel
        const promises = assessmentIds.map((id) => 
          projectAssessmentService.getProjectAssessment(id)
            .then(detail => ({ id, detail }))
            .catch(err => {
              console.error(`Failed to fetch assessment ${id}:`, err);
              return null;
            })
        );
        
        const results = await Promise.all(promises);
        
        // Build map of successful results
        const detailsMap = new Map<number, ProjectAssessmentDetailOut>();
        results.forEach(result => {
          if (result) {
            detailsMap.set(result.id, result.detail);
          }
        });
        
        setDetails(detailsMap);
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "Could not load project details";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [assessmentIds.join(',')]); // Only re-fetch if the list of IDs changes

  return { details, loading, error };
}
