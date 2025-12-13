"use client";

import { useEffect, useState, useCallback } from "react";
import { studentService, projectAssessmentService } from "@/services";
import { ApiAuthError } from "@/lib/api";

/**
 * Learning goal type for the overview tab
 */
type LearningGoal = {
  id: string;
  title: string;
  status: "actief" | "afgerond";
  since?: string;
  related?: string;
};

/**
 * Reflection type for the overview tab
 */
type Reflection = {
  id: string;
  title: string;
  type: string;
  date: string;
};

/**
 * Project result type for the overview tab
 */
type ProjectResult = {
  id: string;
  project: string;
  meta?: string;
  opdrachtgever?: string;
  periode?: string;
  eindcijfer?: number;
  proces?: number;
  eindresultaat?: number;
  communicatie?: number;
};

/**
 * Competency profile category score
 */
type CompetencyProfileData = {
  category: string;
  value: number;
};

/**
 * Overview data for the student dashboard
 */
export type StudentOverviewData = {
  competencyProfile: CompetencyProfileData[];
  learningGoals: LearningGoal[];
  reflections: Reflection[];
  projectResults: ProjectResult[];
};

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
      const competencyProfile: CompetencyProfileData[] = growthData.competency_profile.map(
        (item) => ({
          category: item.name,
          value: item.value,
        })
      );

      // Transform learning goals from growth data
      const learningGoals: LearningGoal[] = growthData.goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        status: goal.status === "active" ? "actief" : "afgerond",
        related: goal.related_competencies.join(", "),
      }));

      // Transform reflections from growth data (competency scan reflections)
      const reflections: Reflection[] = growthData.reflections.map((refl) => ({
        id: refl.id,
        title: refl.scan_title,
        type: "Competentiescan",
        date: refl.date,
      }));

      // Fetch evaluation reflections separately
      try {
        const evaluations = await studentService.getMyEvaluations();
        
        // Get reflections from closed evaluations
        for (const evaluation of evaluations) {
          if (evaluation.status === "closed" && evaluation.reflectionCompleted) {
            try {
              const reflection = await studentService.getReflection(evaluation.id);
              if (reflection && reflection.submitted_at) {
                reflections.push({
                  id: `eval-${evaluation.id}`,
                  title: evaluation.title,
                  type: "Evaluatie",
                  date: new Date(reflection.submitted_at).toLocaleDateString("nl-NL"),
                });
              }
            } catch {
              // Ignore errors for individual reflections
            }
          }
        }
      } catch {
        // If we can't fetch evaluation reflections, continue with what we have
      }

      // Fetch published project assessments
      const projectResults: ProjectResult[] = [];
      try {
        const assessmentsData = await projectAssessmentService.getProjectAssessments(
          undefined,
          undefined,
          "published"
        );

        // For each published assessment, fetch details to get scores and grade
        for (const assessment of assessmentsData.items || []) {
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

            // Extract specific categories (if they exist)
            const proces = categoryAverages["Proces"] || categoryAverages["proces"];
            const eindresultaat = categoryAverages["Eindresultaat"] || categoryAverages["eindresultaat"];
            const communicatie = categoryAverages["Communicatie"] || categoryAverages["communicatie"];

            projectResults.push({
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
            });
          } catch {
            // If we can't fetch details for this assessment, skip it
          }
        }
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
