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
  EmailRubricResponse,
} from "@/dtos/project-assessment.dto";

export const projectAssessmentService = {
  /**
   * Get list of project assessments with optional filters
   */
  async getProjectAssessments(
    groupId?: number,
    courseId?: number,
    status?: string,
  ): Promise<ProjectAssessmentListResponse> {
    const params = new URLSearchParams();
    if (groupId) params.set("group_id", groupId.toString());
    if (courseId) params.set("course_id", courseId.toString());
    if (status) params.set("status", status);
    const queryString = params.toString();
    const url = queryString
      ? `/project-assessments?${queryString}`
      : "/project-assessments";
    const response = await api.get<ProjectAssessmentListResponse>(url);
    return response.data;
  },

  /**
   * Get a single project assessment by ID with details
   */
  async getProjectAssessment(
    id: number,
    teamNumber?: number,
  ): Promise<ProjectAssessmentDetailOut> {
    const params = new URLSearchParams();
    if (teamNumber !== undefined) {
      params.set("team_number", teamNumber.toString());
    }
    const queryString = params.toString();
    const url = queryString
      ? `/project-assessments/${id}?${queryString}`
      : `/project-assessments/${id}`;
    const response = await api.get<ProjectAssessmentDetailOut>(url);
    return response.data;
  },

  /**
   * Create a new project assessment
   */
  async createProjectAssessment(
    data: ProjectAssessmentCreate,
  ): Promise<ProjectAssessmentOut> {
    const response = await api.post<ProjectAssessmentOut>(
      "/project-assessments",
      data,
    );
    return response.data;
  },

  /**
   * Update an existing project assessment
   */
  async updateProjectAssessment(
    id: number,
    data: ProjectAssessmentUpdate,
  ): Promise<ProjectAssessmentOut> {
    const response = await api.put<ProjectAssessmentOut>(
      `/project-assessments/${id}`,
      data,
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
    data: ProjectAssessmentScoreBatchRequest,
  ): Promise<ProjectAssessmentScoreOut[]> {
    const response = await api.post<ProjectAssessmentScoreOut[]>(
      `/project-assessments/${assessmentId}/scores/batch`,
      data,
    );
    return response.data;
  },

  /**
   * Create or update reflection for a project assessment (student)
   */
  async createOrUpdateReflection(
    assessmentId: number,
    data: ProjectAssessmentReflectionCreate,
  ): Promise<ProjectAssessmentReflectionOut> {
    const response = await api.post<ProjectAssessmentReflectionOut>(
      `/project-assessments/${assessmentId}/reflection`,
      data,
    );
    return response.data;
  },

  /**
   * Get team overview for a project assessment (teacher)
   */
  async getTeamOverview(
    assessmentId: number,
  ): Promise<ProjectAssessmentTeamOverview> {
    const response = await api.get<ProjectAssessmentTeamOverview>(
      `/project-assessments/${assessmentId}/teams`,
    );
    return response.data;
  },

  /**
   * Get all reflections for a project assessment (teacher)
   */
  async getReflections(
    assessmentId: number,
  ): Promise<ProjectAssessmentReflectionsOverview> {
    const response = await api.get<ProjectAssessmentReflectionsOverview>(
      `/project-assessments/${assessmentId}/reflections`,
    );
    return response.data;
  },

  /**
   * Get scores overview for a project assessment (teacher)
   */
  async getScoresOverview(
    assessmentId: number,
  ): Promise<ProjectAssessmentScoresOverview> {
    const response = await api.get<ProjectAssessmentScoresOverview>(
      `/project-assessments/${assessmentId}/scores-overview`,
    );
    return response.data;
  },

  /**
   * Get individual students overview for a project assessment (teacher)
   */
  async getStudentsOverview(
    assessmentId: number,
  ): Promise<ProjectAssessmentStudentsOverview> {
    const response = await api.get<ProjectAssessmentStudentsOverview>(
      `/project-assessments/${assessmentId}/students-overview`,
    );
    return response.data;
  },

  /**
   * Get student's own self-assessment
   */
  async getSelfAssessment(
    assessmentId: number,
  ): Promise<SelfAssessmentDetailOut> {
    const response = await api.get<SelfAssessmentDetailOut>(
      `/project-assessments/${assessmentId}/self`,
    );
    return response.data;
  },

  /**
   * Create or update student's self-assessment
   */
  async createOrUpdateSelfAssessment(
    assessmentId: number,
    data: SelfAssessmentCreate,
  ): Promise<SelfAssessmentOut> {
    const response = await api.post<SelfAssessmentOut>(
      `/project-assessments/${assessmentId}/self`,
      data,
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
    direction?: string,
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

  /**
   * Extract the filename from a Content-Disposition header value.
   * Supports both `filename*=UTF-8''...` (RFC 5987) and plain `filename=...`.
   */
  _filenameFromHeader(header: string | null, fallback: string): string {
    if (!header) return fallback;
    const rfcMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (rfcMatch) return decodeURIComponent(rfcMatch[1]);
    const plainMatch = header.match(/filename="?([^";]+)"?/i);
    if (plainMatch) return plainMatch[1];
    return fallback;
  },

  /**
   * Export rubric for a single team as a Word document
   */
  async exportTeamRubric(
    assessmentId: number,
    teamNumber: number,
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await api.get(
      `/project-assessments/${assessmentId}/export-rubric?team_number=${teamNumber}`,
      { responseType: "blob" },
    );
    const filename = this._filenameFromHeader(
      response.headers["content-disposition"] as string | null,
      `Rubric_Team${teamNumber}.docx`,
    );
    return { blob: response.data, filename };
  },

  /**
   * Export rubrics for all teams as a single Word document
   */
  async exportAllRubrics(
    assessmentId: number,
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await api.get(
      `/project-assessments/${assessmentId}/export-rubric-all`,
      { responseType: "blob" },
    );
    const filename = this._filenameFromHeader(
      response.headers["content-disposition"] as string | null,
      "Rubrics.docx",
    );
    return { blob: response.data, filename };
  },

  /**
   * Email rubric Word document to team members of a single team
   */
  async emailTeamRubric(
    assessmentId: number,
    teamNumber: number,
  ): Promise<EmailRubricResponse> {
    const response = await api.post<EmailRubricResponse>(
      `/project-assessments/${assessmentId}/email-rubric`,
      { team_numbers: [teamNumber] },
    );
    return response.data;
  },

  /**
   * Email rubric Word documents to team members of all specified teams
   */
  async emailAllRubrics(
    assessmentId: number,
    teamNumbers: number[],
  ): Promise<EmailRubricResponse> {
    const response = await api.post<EmailRubricResponse>(
      `/project-assessments/${assessmentId}/email-rubric`,
      { team_numbers: teamNumbers },
    );
    return response.data;
  },
};
