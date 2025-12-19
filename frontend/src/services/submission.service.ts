import api from "@/lib/api";
import {
  SubmissionOut,
  SubmissionCreate,
  SubmissionStatusUpdate,
  SubmissionListResponse,
} from "@/dtos/submission.dto";

export const submissionService = {
  /**
   * Submit or update a link for a team's assessment
   * Only team members can submit for their team
   */
  async submitLink(
    assessmentId: number,
    teamId: number,
    data: SubmissionCreate
  ): Promise<SubmissionOut> {
    const response = await api.post<SubmissionOut>(
      `/submissions/assessments/${assessmentId}/teams/${teamId}`,
      data
    );
    return response.data;
  },

  /**
   * Clear a submission (remove URL and set status to missing)
   */
  async clearSubmission(submissionId: number): Promise<void> {
    await api.delete(`/submissions/${submissionId}`);
  },

  /**
   * Update submission status (teacher only)
   */
  async updateStatus(
    submissionId: number,
    data: SubmissionStatusUpdate
  ): Promise<SubmissionOut> {
    const response = await api.patch<SubmissionOut>(
      `/submissions/${submissionId}/status`,
      data
    );
    return response.data;
  },

  /**
   * Get all submissions for an assessment (teacher view)
   */
  async getSubmissionsForAssessment(
    assessmentId: number,
    docType?: string,
    status?: string,
    missingOnly?: boolean
  ): Promise<SubmissionListResponse> {
    const params = new URLSearchParams();
    if (docType) params.set("doc_type", docType);
    if (status) params.set("status", status);
    if (missingOnly) params.set("missing_only", "true");
    const queryString = params.toString();
    const url = queryString
      ? `/submissions/assessments/${assessmentId}/submissions?${queryString}`
      : `/submissions/assessments/${assessmentId}/submissions`;
    const response = await api.get<SubmissionListResponse>(url);
    return response.data;
  },

  /**
   * Get submissions for current user's team (student view)
   */
  async getMyTeamSubmissions(assessmentId: number): Promise<SubmissionOut[]> {
    const response = await api.get<SubmissionOut[]>(
      `/submissions/assessments/${assessmentId}/my-team`
    );
    return response.data;
  },
};
