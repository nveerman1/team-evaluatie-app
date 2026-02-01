import api from "@/lib/api";
import {
  ProjectPlan,
  ProjectPlanListItem,
  ProjectPlanListResponse,
  ProjectPlanUpdate,
  ProjectPlanSectionUpdate,
  TeacherSectionReview,
  TeacherGlobalReview,
  ProjectPlanSectionKey,
} from "@/dtos/projectplan.dto";

export const projectPlanService = {
  // ============ Teacher Endpoints ============

  /**
   * List all project plans (teacher view) with filtering
   */
  async listProjectPlans(params?: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: string;
  }): Promise<ProjectPlanListResponse> {
    const response = await api.get<ProjectPlanListResponse>(
      "/teacher/projectplans",
      { params }
    );
    return response.data;
  },

  /**
   * Get a specific project plan detail (teacher view)
   */
  async getProjectPlan(planId: number): Promise<ProjectPlan> {
    const response = await api.get<ProjectPlan>(`/teacher/projectplans/${planId}`);
    return response.data;
  },

  /**
   * Update project plan (GO/NO-GO decision)
   */
  async updateProjectPlan(
    planId: number,
    data: ProjectPlanUpdate
  ): Promise<ProjectPlan> {
    const response = await api.patch<ProjectPlan>(
      `/teacher/projectplans/${planId}`,
      data
    );
    return response.data;
  },

  /**
   * Teacher GO decision
   */
  async setGO(planId: number, review: TeacherGlobalReview): Promise<ProjectPlan> {
    const response = await api.patch<ProjectPlan>(
      `/teacher/projectplans/${planId}`,
      review
    );
    return response.data;
  },

  /**
   * Teacher NO-GO decision
   */
  async setNoGo(
    planId: number,
    review: TeacherGlobalReview
  ): Promise<ProjectPlan> {
    const response = await api.patch<ProjectPlan>(
      `/teacher/projectplans/${planId}`,
      review
    );
    return response.data;
  },

  /**
   * Update section feedback (teacher)
   */
  async updateSectionFeedback(
    planId: number,
    sectionKey: ProjectPlanSectionKey,
    data: TeacherSectionReview
  ): Promise<ProjectPlan> {
    const response = await api.patch<ProjectPlan>(
      `/teacher/projectplans/${planId}/sections/${sectionKey}`,
      data
    );
    return response.data;
  },

  // ============ Student Endpoints ============

  /**
   * Get project plan by project ID (student view)
   */
  async getMyProjectPlan(projectId: number): Promise<ProjectPlan> {
    const response = await api.get<ProjectPlan>(`/me/projectplans/${projectId}`);
    return response.data;
  },

  /**
   * Update project plan title (student)
   */
  async updateMyProjectPlan(
    planId: number,
    data: ProjectPlanUpdate
  ): Promise<ProjectPlan> {
    const response = await api.patch<ProjectPlan>(
      `/me/projectplans/${planId}`,
      data
    );
    return response.data;
  },

  /**
   * Update section content (student)
   */
  async updateMySection(
    planId: number,
    sectionKey: ProjectPlanSectionKey,
    data: ProjectPlanSectionUpdate
  ): Promise<ProjectPlan> {
    const response = await api.patch<ProjectPlan>(
      `/me/projectplans/${planId}/sections/${sectionKey}`,
      data
    );
    return response.data;
  },

  /**
   * Submit plan for review (student)
   */
  async submitPlan(planId: number): Promise<ProjectPlan> {
    const response = await api.post<ProjectPlan>(
      `/me/projectplans/${planId}/submit`,
      {}
    );
    return response.data;
  },
};
