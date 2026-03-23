import api from "@/lib/api";
import {
  ProjectFeedbackRound,
  ProjectFeedbackRoundCreate,
  ProjectFeedbackRoundDetail,
  ProjectFeedbackRoundUpdate,
  ProjectFeedbackResults,
  ProjectFeedbackResponse,
  ProjectFeedbackSubmission,
} from "@/dtos/project-feedback.dto";

export const projectFeedbackService = {
  /**
   * List feedback rounds (teacher: all, student: open rounds for their projects)
   */
  async listRounds(params?: {
    project_id?: number;
    status?: string;
  }): Promise<ProjectFeedbackRound[]> {
    const response = await api.get<ProjectFeedbackRound[]>("/project-feedback", {
      params,
    });
    return response.data;
  },

  /**
   * List open feedback rounds for the current student
   */
  async listStudentRounds(): Promise<ProjectFeedbackRound[]> {
    const response = await api.get<ProjectFeedbackRound[]>(
      "/project-feedback/student"
    );
    return response.data;
  },

  /**
   * Get round detail with questions
   */
  async getRound(roundId: number): Promise<ProjectFeedbackRoundDetail> {
    const response = await api.get<ProjectFeedbackRoundDetail>(
      `/project-feedback/${roundId}`
    );
    return response.data;
  },

  /**
   * Create a new feedback round (seeds default questions if none provided)
   */
  async createRound(data: ProjectFeedbackRoundCreate): Promise<ProjectFeedbackRound> {
    const response = await api.post<ProjectFeedbackRound>("/project-feedback", data);
    return response.data;
  },

  /**
   * Update round title and/or questions
   */
  async updateRound(
    roundId: number,
    data: ProjectFeedbackRoundUpdate
  ): Promise<ProjectFeedbackRound> {
    const response = await api.put<ProjectFeedbackRound>(
      `/project-feedback/${roundId}`,
      data
    );
    return response.data;
  },

  /**
   * Delete a feedback round
   */
  async deleteRound(roundId: number): Promise<void> {
    await api.delete(`/project-feedback/${roundId}`);
  },

  /**
   * Open a round for student submissions
   */
  async openRound(roundId: number): Promise<ProjectFeedbackRound> {
    const response = await api.post<ProjectFeedbackRound>(
      `/project-feedback/${roundId}/open`
    );
    return response.data;
  },

  /**
   * Close a round
   */
  async closeRound(roundId: number): Promise<ProjectFeedbackRound> {
    const response = await api.post<ProjectFeedbackRound>(
      `/project-feedback/${roundId}/close`
    );
    return response.data;
  },

  /**
   * Get aggregated results for a round (teacher only)
   */
  async getResults(roundId: number): Promise<ProjectFeedbackResults> {
    const response = await api.get<ProjectFeedbackResults>(
      `/project-feedback/${roundId}/results`
    );
    return response.data;
  },

  /**
   * Get the current student's response for a round
   */
  async getMyResponse(roundId: number): Promise<ProjectFeedbackResponse> {
    const response = await api.get<ProjectFeedbackResponse>(
      `/project-feedback/${roundId}/my-response`
    );
    return response.data;
  },

  /**
   * Submit feedback answers
   */
  async submitFeedback(
    roundId: number,
    data: ProjectFeedbackSubmission
  ): Promise<ProjectFeedbackResponse> {
    const response = await api.post<ProjectFeedbackResponse>(
      `/project-feedback/${roundId}/submit`,
      data
    );
    return response.data;
  },
};
