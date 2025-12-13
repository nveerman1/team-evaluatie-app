"use client";

import { useEffect, useState, useCallback } from "react";
import { studentService, projectAssessmentService } from "@/services";
import { ApiAuthError } from "@/lib/api";
import type {
  StudentOverviewData,
  OverviewLearningGoal,
  OverviewReflection,
  OverviewProjectResult,
  OverviewCompetencyProfile,
} from "@/dtos";

/**
 * Hook to fetch all data needed for the student overview tab
 */
export function useStudentOverview() {
  const [data, setData] = useState<StudentOverviewData>({
    competencyProfile: [],
    learningGoals: [],
    reflections: [],
    projectResults: [],
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverviewData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch student growth data which includes competency profile, goals, and reflections
      const growthData = await studentService.getGrowthData();

      // Transform competency profile from growth data
      const competencyProfile: OverviewCompetencyProfile[] = growthData.competency_profile.map(
        (item) => ({
          category: item.name,
          value: item.value,
        })
      );

      // Transform learning goals from growth data
      const learningGoals: OverviewLearningGoal[] = growthData.goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        status: goal.status === "active" ? "actief" : "afgerond",
        related: goal.related_competencies.join(", "),
      }));

      // Transform reflections from growth data (competency scan reflections)
      const reflections: OverviewReflection[] = growthData.reflections.map((refl) => ({
        id: refl.id,
        title: refl.scan_title,
        type: "Competentiescan",
        date: refl.date,
      }));

      // Fetch evaluation reflections separately
      try {
        const evaluations = await studentService.getMyEvaluations();
        
        // Get reflections from closed evaluations in parallel
        const closedEvaluations = evaluations.filter(
          (e) => e.status === "closed" && e.reflectionCompleted
        );
        
        const reflectionPromises = closedEvaluations.map(async (evaluation) => {
          try {
            const reflection = await studentService.getReflection(evaluation.id);
            if (reflection && reflection.submitted_at) {
              return {
                id: `eval-${evaluation.id}`,
                title: evaluation.title,
                type: "Evaluatie",
                date: new Date(reflection.submitted_at).toLocaleDateString("nl-NL"),
              };
            }
          } catch {
            // Ignore errors for individual reflections
          }
          return null;
        });
        
        const evaluationReflections = (await Promise.allSettled(reflectionPromises))
          .filter((result) => result.status === "fulfilled" && result.value !== null)
          .map((result) => (result as PromiseFulfilledResult<OverviewReflection | null>).value) as OverviewReflection[];
        
        reflections.push(...evaluationReflections);
      } catch {
        // If we can't fetch evaluation reflections, continue with what we have
      }

      // Fetch published project assessments
      const projectResults: OverviewProjectResult[] = [];
      try {
        const assessmentsData = await projectAssessmentService.getProjectAssessments(
          undefined,
          undefined,
          "published"
        );

        // Fetch all assessment details in parallel
        const assessmentPromises = (assessmentsData.items || []).map(async (assessment) => {
          try {
            const details = await projectAssessmentService.getProjectAssessment(assessment.id);
            
            // Calculate category averages from scores and criteria
            const categoryScores: Record<string, number[]> = {};
            
            details.scores.forEach((score) => {
              const criterion = details.criteria.find((c) => c.id === score.criterion_id);
              if (criterion && criterion.category) {
                if (!categoryScores[criterion.category]) {
                  categoryScores[criterion.category] = [];
                }
                categoryScores[criterion.category].push(score.score);
              }
            });

            // Calculate averages for each category
            const categoryAverages: Record<string, number> = {};
            Object.entries(categoryScores).forEach(([category, scores]) => {
              const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
              categoryAverages[category] = avg;
            });

            // Normalize category names to lowercase for consistent lookups
            const normalizedAverages = Object.fromEntries(
              Object.entries(categoryAverages).map(([key, value]) => [key.toLowerCase(), value])
            );

            // Extract specific categories (with normalized names)
            const proces = normalizedAverages["proces"];
            const eindresultaat = normalizedAverages["eindresultaat"];
            const communicatie = normalizedAverages["communicatie"];

            return {
              id: assessment.id.toString(),
              project: assessment.title,
              meta: assessment.group_name || undefined,
              opdrachtgever: assessment.metadata_json?.client || undefined,
              periode: assessment.published_at
                ? new Date(assessment.published_at).toLocaleDateString("nl-NL", {
                    month: "short",
                    year: "numeric",
                  })
                : undefined,
              eindcijfer: details.grade || undefined,
              proces,
              eindresultaat,
              communicatie,
            };
          } catch {
            // If we can't fetch details for this assessment, return null
            return null;
          }
        });
        
        const assessmentResults = (await Promise.allSettled(assessmentPromises))
          .filter((result) => result.status === "fulfilled" && result.value !== null)
          .map((result) => (result as PromiseFulfilledResult<OverviewProjectResult | null>).value) as OverviewProjectResult[];
        
        projectResults.push(...assessmentResults);
      } catch {
        // If we can't fetch project assessments, continue with empty array
      }

      setData({
        competencyProfile,
        learningGoals,
        reflections,
        projectResults,
      });
    } catch (e: unknown) {
      if (e instanceof ApiAuthError) {
        setError(e.friendlyMessage);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Kon overzicht-data niet laden");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchOverviewData,
  };
}
