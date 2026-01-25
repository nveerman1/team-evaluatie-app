"use client";

import { useEffect, useState, useCallback } from "react";
import { studentService, projectAssessmentService, projectService, overviewService } from "@/services";
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
    scans: [],
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

      // Keep scans list for selector
      const scans = growthData.scans || [];

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
        text: refl.snippet, // Use snippet as reflection text
      }));

      // Fetch evaluation reflections separately (peer evaluation reflections)
      try {
        const evaluations = await studentService.getMyEvaluations();
        
        // Get reflections from all evaluations that have a reflection completed
        const evaluationsWithReflection = evaluations.filter(
          (e) => e.reflectionCompleted
        );
        
        const reflectionPromises = evaluationsWithReflection.map(async (evaluation) => {
          try {
            const reflection = await studentService.getReflection(evaluation.id);
            if (reflection && reflection.submitted_at) {
              return {
                id: `eval-${evaluation.id}`,
                title: evaluation.title,
                type: "Peerevaluatie",
                date: new Date(reflection.submitted_at).toLocaleDateString("nl-NL"),
                text: reflection.text || undefined, // Include reflection text if available
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

        // Filter out external assessments (those without a teacher_id)
        const teacherAssessments = (assessmentsData.items || []).filter(
          (assessment) => assessment.teacher_id != null
        );

        // Fetch all assessment details in parallel
        const assessmentPromises = teacherAssessments.map(async (assessment) => {
          try {
            const details = await projectAssessmentService.getProjectAssessment(assessment.id);
            
            // Get client name directly from the assessment list response (now includes client_name)
            let clientName = (assessment as any).client_name || assessment.metadata_json?.client;
            
            // Get category scores from backend using the same logic as teacher overview
            // This ensures consistency across all views (student overview, student detail, teacher overview)
            let proces: number | undefined;
            let eindresultaat: number | undefined;
            let communicatie: number | undefined;
            
            try {
              // Fetch team scores from backend - this uses the correct weighted average and curved mapping
              const teamsResponse = await overviewService.getProjectTeams(assessment.id);
              
              // Find the student's team in the assessment
              // The details.scores contain team_number, so we can identify which team the student belongs to
              const studentTeamNumber = details.scores.find(s => s.team_number !== null)?.team_number;
              
              if (studentTeamNumber !== undefined && studentTeamNumber !== null) {
                const studentTeam = teamsResponse.teams.find(t => t.team_number === studentTeamNumber);
                
                if (studentTeam && studentTeam.category_scores) {
                  // Use backend-calculated category scores (weighted + curved)
                  proces = studentTeam.category_scores.projectproces || studentTeam.category_scores.proces;
                  eindresultaat = studentTeam.category_scores.eindresultaat;
                  communicatie = studentTeam.category_scores.communicatie;
                }
              }
            } catch (error) {
              // If we can't fetch team scores, leave category scores as undefined
              console.warn(`Could not fetch team scores for assessment ${assessment.id}:`, error);
            }

            return {
              id: assessment.id.toString(),
              project: assessment.title,
              // meta: removed - no longer showing group_name as it's legacy data
              opdrachtgever: clientName,
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
        scans,
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
