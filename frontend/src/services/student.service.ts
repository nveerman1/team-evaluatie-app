import api, { ApiAuthError } from "@/lib/api";
import {
  StudentEvaluation,
  StudentDashboard,
  StudentResult,
  ReflectionSubmit,
  MyAllocation,
  Criterion,
  ScoreItem,
} from "@/dtos";

export const studentService = {
  /**
   * Get all evaluations allocated to the current student
   * @param status - Optional status filter: "open", "closed", or undefined for all
   */
  async getMyEvaluations(status?: "open" | "closed"): Promise<StudentEvaluation[]> {
    try {
      const params: { status?: string } = {};
      if (status) {
        params.status = status;
      }
      const { data } = await api.get<any[]>("/evaluations", { params });
      
      // For each evaluation, fetch allocations to calculate progress
      const evaluations = await Promise.all(
        data.map(async (evaluation) => {
          try {
            const allocsRes = await api.get<MyAllocation[]>("/allocations/my", {
              params: { evaluation_id: evaluation.id },
            });
            const allocs = allocsRes.data || [];
            
            const selfAlloc = allocs.find((a) => a.is_self);
            const peerAllocs = allocs.filter((a) => !a.is_self);
            
            const selfCompleted = selfAlloc?.completed ?? false;
            const peersCompleted = peerAllocs.filter((a) => a.completed).length;
            const peersTotal = peerAllocs.length;
            
            // Check reflection status
            let reflectionCompleted = false;
            try {
              const refRes = await api.get(
                `/evaluations/${evaluation.id}/reflections/me`
              );
              reflectionCompleted = !!refRes.data?.submitted_at;
            } catch {
              // No reflection yet
            }
            
            // Calculate overall progress
            const totalSteps = 4; // self, peers, overview, reflection
            let completedSteps = 0;
            if (selfCompleted) completedSteps++;
            if (peersTotal === 0 || peersCompleted === peersTotal) completedSteps++;
            completedSteps++; // overview is just a view, always "complete"
            if (reflectionCompleted) completedSteps++;
            
            const progress = Math.round((completedSteps / totalSteps) * 100);
            
            // Determine next step
            let nextStep = 1;
            if (selfCompleted) {
              if (peersCompleted < peersTotal) nextStep = 2;
              else if (!reflectionCompleted) nextStep = 4;
              else nextStep = 3; // all done, show overview
            }
            
            return {
              ...evaluation,
              progress,
              selfCompleted,
              peersCompleted,
              peersTotal,
              reflectionCompleted,
              canStartPeers: selfCompleted,
              canSubmitReflection: selfCompleted && peersCompleted === peersTotal,
              nextStep,
            } as StudentEvaluation;
          } catch {
            // If allocations fail, return basic evaluation
            return {
              ...evaluation,
              progress: 0,
              selfCompleted: false,
              peersCompleted: 0,
              peersTotal: 0,
              reflectionCompleted: false,
              canStartPeers: false,
              canSubmitReflection: false,
              nextStep: 1,
            } as StudentEvaluation;
          }
        })
      );
      
      return evaluations;
    } catch (error) {
      // Handle ApiAuthError separately
      if (error instanceof ApiAuthError) {
        // For 403, this could be a business case (e.g., no self-assessment yet)
        // We'll let the caller (getDashboard) handle this appropriately
        throw error;
      }
      // Re-throw other errors
      throw error;
    }
  },

  /**
   * Get dashboard summary for student
   */
  async getDashboard(): Promise<StudentDashboard> {
    try {
      // Fetch all evaluations to check if student has any
      const allEvaluations = await this.getMyEvaluations();
      const openEvaluations = allEvaluations.filter((e) => e.status === "open");
      
      const completedEvaluations = allEvaluations.filter(
        (e) => e.progress === 100
      ).length;
      
      const pendingReviews = openEvaluations.reduce(
        (sum, e) => sum + (e.peersTotal - e.peersCompleted),
        0
      );
      
      const pendingReflections = openEvaluations.filter(
        (e) => !e.reflectionCompleted && e.canSubmitReflection
      ).length;
      
      // Fetch competency windows and project assessments in parallel
      let openScans = 0;
      let newAssessments = 0;
      let userName: string | undefined;
      let userClass: string | undefined;
      
      try {
        const [windows, assessments] = await Promise.all([
          api.get("/competencies/windows", { params: { status: "open" } }),
          api.get("/project-assessments"),
        ]);
        
        openScans = windows.data?.length || 0;
        newAssessments = assessments.data?.length || 0;
        
        // Try to get user info from first competency window if available
        if (windows.data && windows.data.length > 0) {
          try {
            const overview = await api.get(`/competencies/windows/${windows.data[0].id}/overview`);
            userName = overview.data?.user_name;
            // Note: class_name is not in StudentCompetencyOverview, we'll try to get it from evaluations
          } catch {
            // Ignore error, user info is optional
          }
        }
      } catch {
        // Ignore errors for these optional counts
      }
      
      return {
        openEvaluations,
        completedEvaluations,
        pendingReviews,
        pendingReflections,
        hasAnyEvaluations: allEvaluations.length > 0,
        canReviewPeers: true,
        needsSelfAssessment: false,
        openScans,
        newAssessments,
        userName,
        userClass,
      };
    } catch (error) {
      // Handle ApiAuthError for business cases
      if (error instanceof ApiAuthError && error.status === 403) {
        // Business case: student needs to complete self-assessment first
        // Return a dashboard indicating they need to complete self-assessment
        return {
          openEvaluations: [],
          completedEvaluations: 0,
          pendingReviews: 0,
          pendingReflections: 0,
          hasAnyEvaluations: false,
          canReviewPeers: false,
          needsSelfAssessment: true,
          openScans: 0,
          newAssessments: 0,
        };
      }
      // Re-throw auth errors (401) or other errors for higher-level handling
      throw error;
    }
  },

  /**
   * Get allocations for a specific evaluation
   */
  async getAllocations(evaluationId: number): Promise<MyAllocation[]> {
    const { data } = await api.get<MyAllocation[]>("/allocations/my", {
      params: { evaluation_id: evaluationId },
    });
    return data || [];
  },

  /**
   * Get criteria for a rubric
   */
  async getCriteria(rubricId: number): Promise<Criterion[]> {
    const { data } = await api.get<Criterion[]>(
      `/rubrics/${rubricId}/criteria`
    );
    return data || [];
  },

  /**
   * Submit scores for an allocation
   */
  async submitScores(
    allocationId: number,
    items: ScoreItem[]
  ): Promise<void> {
    await api.post("/scores", {
      allocation_id: allocationId,
      items,
    });
  },

  /**
   * Get existing scores for an allocation
   */
  async getScores(allocationId: number): Promise<ScoreItem[]> {
    const { data } = await api.get<ScoreItem[]>("/scores/my", {
      params: { allocation_id: allocationId },
    });
    return data || [];
  },

  /**
   * Get reflection for current user in an evaluation
   */
  async getReflection(evaluationId: number): Promise<{
    text: string;
    submitted_at?: string;
  } | null> {
    try {
      const { data } = await api.get(
        `/evaluations/${evaluationId}/reflections/me`
      );
      return data;
    } catch (error: any) {
      // Handle 404 as empty reflection (not created yet)
      if (error?.response?.status === 404) {
        return { text: "", submitted_at: undefined };
      }
      // For ApiAuthError, throw with friendly message
      if (error instanceof ApiAuthError) {
        throw error;
      }
      // Re-throw other errors
      throw error;
    }
  },

  /**
   * Submit or save reflection
   */
  async submitReflection(
    evaluationId: number,
    reflection: ReflectionSubmit
  ): Promise<void> {
    await api.post(`/evaluations/${evaluationId}/reflections/me`, reflection);
  },

  /**
   * Get student results for an evaluation
   */
  async getResults(
    evaluationId: number,
    userId: number
  ): Promise<StudentResult | null> {
    try {
      const { data } = await api.get(
        `/evaluations/${evaluationId}/students/${userId}/overview`
      );
      
      return {
        evaluation_id: data.evaluation_id,
        evaluation_title: "", // Will be filled by caller if needed
        user_id: data.user.id,
        user_name: data.user.name,
        final_grade: data.grade.final,
        suggested_grade: data.grade.suggested,
        group_grade: data.grade.group_grade,
        gcf: data.grade.gcf,
        spr: data.grade.spr,
        teacher_comment: data.grade.reason,
        peer_feedback: (data.feedback_received || []).map((fb: any) => ({
          reviewer_id: fb.reviewer_id,
          reviewer_name: fb.reviewer_name,
          is_self: false,
          comments: fb.comments || [],
          avg_score: fb.score_pct,
        })),
        self_feedback: (data.feedback_given || [])
          .filter((fb: any) => fb.reviewee_id === userId)
          .map((fb: any) => ({
            reviewer_id: userId,
            reviewer_name: data.user.name,
            is_self: true,
            comments: fb.comments || [],
          })),
        reflection: data.reflection
          ? {
              text: data.reflection.text,
              submitted_at: data.reflection.submitted_at,
              editable: !data.reflection.submitted_at, // Can edit if not submitted
            }
          : undefined,
        criteria_summary: [], // Will be calculated from feedback if needed
      };
    } catch {
      return null;
    }
  },

  /**
   * Get all results for the student (all evaluations)
   */
  async getAllResults(userId: number): Promise<StudentResult[]> {
    // Fetch all evaluations (not just open ones) to get closed evaluations with results
    const evaluations = await this.getMyEvaluations();
    const results: StudentResult[] = [];
    
    for (const evaluation of evaluations) {
      if (evaluation.status === "closed" || evaluation.progress === 100) {
        const result = await this.getResults(evaluation.id, userId);
        if (result) {
          result.evaluation_title = evaluation.title;
          results.push(result);
        }
      }
    }
    
    return results;
  },
};
