/**
 * Service for External Assessment API calls
 */
import api from "@/lib/api";
import type {
  ExternalAssessmentTokenInfo,
  ExternalAssessmentDetail,
  ExternalAssessmentSubmit,
  ExternalAssessmentSubmitResponse,
  ExternalEvaluator,
  ExternalEvaluatorCreate,
  ExternalEvaluatorUpdate,
  BulkInviteRequest,
  ExternalAssessmentStatus,
} from "@/dtos/external-assessment.dto";

export const externalAssessmentService = {
  // ============ Public External Assessment Endpoints ============

  /**
   * Resolve an invitation token and get list of teams to assess
   */
  async resolveToken(token: string): Promise<ExternalAssessmentTokenInfo> {
    const response = await api.get(`/external-assessments/${token}`);
    return response.data;
  },

  /**
   * Get assessment detail for a specific team
   */
  async getTeamDetail(
    token: string,
    teamId: number
  ): Promise<ExternalAssessmentDetail> {
    const response = await api.get(
      `/external-assessments/${token}/teams/${teamId}`
    );
    return response.data;
  },

  /**
   * Submit or save assessment scores for a team
   */
  async submitAssessment(
    token: string,
    teamId: number,
    data: ExternalAssessmentSubmit
  ): Promise<ExternalAssessmentSubmitResponse> {
    const response = await api.post(
      `/external-assessments/${token}/teams/${teamId}`,
      data
    );
    return response.data;
  },

  // ============ Teacher Management Endpoints ============

  /**
   * List all external evaluators for the school
   */
  async listEvaluators(): Promise<ExternalEvaluator[]> {
    const response = await api.get("/projects/external-management/evaluators");
    return response.data;
  },

  /**
   * Get a specific external evaluator
   */
  async getEvaluator(evaluatorId: number): Promise<ExternalEvaluator> {
    const response = await api.get(
      `/projects/external-management/evaluators/${evaluatorId}`
    );
    return response.data;
  },

  /**
   * Create a new external evaluator
   */
  async createEvaluator(
    data: ExternalEvaluatorCreate
  ): Promise<ExternalEvaluator> {
    const response = await api.post(
      "/projects/external-management/evaluators",
      data
    );
    return response.data;
  },

  /**
   * Update an external evaluator
   */
  async updateEvaluator(
    evaluatorId: number,
    data: ExternalEvaluatorUpdate
  ): Promise<ExternalEvaluator> {
    const response = await api.put(
      `/projects/external-management/evaluators/${evaluatorId}`,
      data
    );
    return response.data;
  },

  /**
   * Create invitations in bulk (per-team or all-teams mode)
   */
  async createBulkInvitations(data: BulkInviteRequest): Promise<any> {
    const response = await api.post(
      "/projects/external-management/invitations/bulk",
      data
    );
    return response.data;
  },

  /**
   * Get external assessment status for all teams in a project
   */
  async getProjectExternalStatus(
    projectId: number
  ): Promise<ExternalAssessmentStatus[]> {
    const response = await api.get(
      `/projects/external-management/projects/${projectId}/external-status`
    );
    return response.data;
  },
};
