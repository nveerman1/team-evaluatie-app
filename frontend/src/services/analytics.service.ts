import api from "@/lib/api";

export type CourseSummary = {
  total_students: number;
  total_evaluations: number;
  completed_evaluations: number;
  average_score: number;
  participation_rate: number;
};

export type LearningObjectiveProgress = {
  id: number;
  code: string;
  description: string;
  coverage: number; // percentage
  average_score: number;
  student_count: number;
};

export type EvaluationTypeStats = {
  type: "peer" | "project" | "competency";
  count: number;
  avg_score: number;
  completion_rate: number;
};

export const analyticsService = {
  /**
   * Get course summary analytics
   */
  async getCourseSummary(courseId: number): Promise<CourseSummary> {
    const response = await api.get<CourseSummary>(
      `/analytics/courses/${courseId}/summary`
    );
    return response.data;
  },

  /**
   * Get learning objectives progress for a course
   */
  async getLearningObjectivesProgress(
    courseId: number
  ): Promise<LearningObjectiveProgress[]> {
    const response = await api.get<LearningObjectiveProgress[]>(
      `/analytics/courses/${courseId}/learning-objectives`
    );
    return response.data;
  },

  /**
   * Get evaluation type statistics for a course
   */
  async getEvaluationTypeStats(
    courseId: number
  ): Promise<EvaluationTypeStats[]> {
    const response = await api.get<EvaluationTypeStats[]>(
      `/analytics/courses/${courseId}/evaluation-types`
    );
    return response.data;
  },
};
