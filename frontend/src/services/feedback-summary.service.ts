import api from "@/lib/api";
import {
  FeedbackSummaryResponse,
  FeedbackQuotesResponse,
} from "@/dtos/feedback-summary.dto";

export const feedbackSummaryService = {
  /**
   * Get AI summary of peer feedback for a student
   */
  async getStudentSummary(
    evaluationId: number,
    studentId: number
  ): Promise<FeedbackSummaryResponse> {
    const { data } = await api.get<FeedbackSummaryResponse>(
      `/feedback-summaries/evaluation/${evaluationId}/student/${studentId}`
    );
    return data;
  },

  /**
   * Force regeneration of AI summary
   */
  async regenerateSummary(
    evaluationId: number,
    studentId: number
  ): Promise<FeedbackSummaryResponse> {
    const { data } = await api.post<FeedbackSummaryResponse>(
      `/feedback-summaries/evaluation/${evaluationId}/student/${studentId}/regenerate`,
      { force: true }
    );
    return data;
  },

  /**
   * Get anonymized peer feedback quotes
   */
  async getFeedbackQuotes(
    evaluationId: number,
    studentId: number
  ): Promise<FeedbackQuotesResponse> {
    const { data } = await api.get<FeedbackQuotesResponse>(
      `/feedback-summaries/evaluation/${evaluationId}/student/${studentId}/quotes`
    );
    return data;
  },
};
