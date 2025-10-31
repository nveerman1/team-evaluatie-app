import api from "@/lib/api";
import {
  ProjectAssessmentListResponse,
  ProjectAssessmentOut,
  ProjectAssessmentCreate,
  ProjectAssessmentUpdate,
  ProjectAssessmentDetailOut,
  ProjectAssessmentScoreBatchRequest,
  ProjectAssessmentScoreOut,
  ProjectAssessmentReflectionOut,
  ProjectAssessmentReflectionCreate,
} from "@/dtos/project-assessment.dto";

export const projectAssessmentService = {
  /**
   * Get list of project assessments with optional filters
   */
  async getProjectAssessments(
    groupId?: number,
    status?: string
  ): Promise<ProjectAssessmentListResponse> {
    const params = new URLSearchParams();
    if (groupId) params.set("group_id", groupId.toString());
    if (status) params.set("status", status);
    const queryString = params.toString();
    const url = queryString ? `/project-assessments?${queryString}` : "/project-assessments";
    const response = await api.get<ProjectAssessmentListResponse>(url);
    return response.data;
  },

  /**
   * Get a single project assessment by ID with details
   */
  async getProjectAssessment(id: number): Promise<ProjectAssessmentDetailOut> {
    const response = await api.get<ProjectAssessmentDetailOut>(
      `/project-assessments/${id}`
    );
    return response.data;
  },

  /**
   * Create a new project assessment
   */
  async createProjectAssessment(
    data: ProjectAssessmentCreate
  ): Promise<ProjectAssessmentOut> {
    const response = await api.post<ProjectAssessmentOut>(
      "/project-assessments",
      data
    );
    return response.data;
  },

  /**
   * Update an existing project assessment
   */
  async updateProjectAssessment(
    id: number,
    data: ProjectAssessmentUpdate
  ): Promise<ProjectAssessmentOut> {
    const response = await api.put<ProjectAssessmentOut>(
      `/project-assessments/${id}`,
      data
    );
    return response.data;
  },

  /**
   * Delete a project assessment
   */
  async deleteProjectAssessment(id: number): Promise<void> {
    await api.delete(`/project-assessments/${id}`);
  },

  /**
   * Batch create/update scores for a project assessment
   */
  async batchUpdateScores(
    assessmentId: number,
    data: ProjectAssessmentScoreBatchRequest
  ): Promise<ProjectAssessmentScoreOut[]> {
    const response = await api.post<ProjectAssessmentScoreOut[]>(
      `/project-assessments/${assessmentId}/scores/batch`,
      data
    );
    return response.data;
  },

  /**
   * Create or update reflection for a project assessment (student)
   */
  async createOrUpdateReflection(
    assessmentId: number,
    data: ProjectAssessmentReflectionCreate
  ): Promise<ProjectAssessmentReflectionOut> {
    const response = await api.post<ProjectAssessmentReflectionOut>(
      `/project-assessments/${assessmentId}/reflection`,
      data
    );
    return response.data;
  },
};
