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
  ProjectAssessmentTeamOverview,
  ProjectAssessmentReflectionsOverview,
  ProjectAssessmentScoresOverview,
  ProjectAssessmentStudentsOverview,
  SelfAssessmentDetailOut,
  SelfAssessmentOut,
  SelfAssessmentCreate,
  ProjectAssessmentSelfOverview,
} from "@/dtos/project-assessment.dto";

export const projectAssessmentService = {
  /**
   * Get list of project assessments with optional filters
   */
  async getProjectAssessments(
    groupId?: number,
    courseId?: number,
    status?: string
  ): Promise<ProjectAssessmentListResponse> {
    const params = new URLSearchParams();
    if (groupId) params.set("group_id", groupId.toString());
    if (courseId) params.set("course_id", courseId.toString());
    if (status) params.set("status", status);
    const queryString = params.toString();
    const url = queryString ? `/project-assessments?${queryString}` : "/project-assessments";
    const response = await api.get<ProjectAssessmentListResponse>(url);
    return response.data;
  },

  /**
   * Get a single project assessment by ID with details
   */
  async getProjectAssessment(id: number, teamNumber?: number): Promise<ProjectAssessmentDetailOut> {
    const params = new URLSearchParams();
    if (teamNumber !== undefined) {
      params.set("team_number", teamNumber.toString());
    }
    const queryString = params.toString();
    const url = queryString ? `/project-assessments/${id}?${queryString}` : `/project-assessments/${id}`;
    const response = await api.get<ProjectAssessmentDetailOut>(url);
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

  /**
   * Get team overview for a project assessment (teacher)
   */
  async getTeamOverview(
    assessmentId: number
  ): Promise<ProjectAssessmentTeamOverview> {
    const response = await api.get<ProjectAssessmentTeamOverview>(
      `/project-assessments/${assessmentId}/teams`
    );
    return response.data;
  },

  /**
   * Get all reflections for a project assessment (teacher)
   */
  async getReflections(
    assessmentId: number
  ): Promise<ProjectAssessmentReflectionsOverview> {
    const response = await api.get<ProjectAssessmentReflectionsOverview>(
      `/project-assessments/${assessmentId}/reflections`
    );
    return response.data;
  },

  /**
   * Get scores overview for a project assessment (teacher)
   */
  async getScoresOverview(
    assessmentId: number
  ): Promise<ProjectAssessmentScoresOverview> {
    const response = await api.get<ProjectAssessmentScoresOverview>(
      `/project-assessments/${assessmentId}/scores-overview`
    );
    return response.data;
  },

  /**
   * Get individual students overview for a project assessment (teacher)
   */
  async getStudentsOverview(
    assessmentId: number
  ): Promise<ProjectAssessmentStudentsOverview> {
    const response = await api.get<ProjectAssessmentStudentsOverview>(
      `/project-assessments/${assessmentId}/students-overview`
    );
    return response.data;
  },

  /**
   * Get student's own self-assessment
   */
  async getSelfAssessment(
    assessmentId: number
  ): Promise<SelfAssessmentDetailOut> {
    const response = await api.get<SelfAssessmentDetailOut>(
      `/project-assessments/${assessmentId}/self`
    );
    return response.data;
  },

  /**
   * Create or update student's self-assessment
   */
  async createOrUpdateSelfAssessment(
    assessmentId: number,
    data: SelfAssessmentCreate
  ): Promise<SelfAssessmentOut> {
    const response = await api.post<SelfAssessmentOut>(
      `/project-assessments/${assessmentId}/self`,
      data
    );
    return response.data;
  },

  /**
   * Get self-assessment overview for teachers
   */
  async getSelfAssessmentOverview(
    assessmentId: number,
    q?: string,
    sort?: string,
    direction?: string
  ): Promise<ProjectAssessmentSelfOverview> {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    if (direction) params.set("direction", direction);
    const queryString = params.toString();
    const url = queryString
      ? `/project-assessments/${assessmentId}/self/overview?${queryString}`
      : `/project-assessments/${assessmentId}/self/overview`;
    const response = await api.get<ProjectAssessmentSelfOverview>(url);
    return response.data;
  },
};
