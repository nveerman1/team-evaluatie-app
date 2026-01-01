import api from "@/lib/api";
import {
  FeedbackSummaryResponse,
  FeedbackQuotesResponse,
  JobStatusResponse,
  BatchQueueResponse,
} from "@/dtos/feedback-summary.dto";

export const feedbackSummaryService = {
  /**
   * Get AI summary of peer feedback for a student (sync mode)
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
   * Queue async generation of AI summary
   */
  async queueSummaryGeneration(
    evaluationId: number,
    studentId: number
  ): Promise<JobStatusResponse> {
    const { data } = await api.post<JobStatusResponse>(
      `/feedback-summaries/evaluation/${evaluationId}/student/${studentId}/queue`
    );
    return data;
  },

  /**
   * Check status of a queued job
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const { data } = await api.get<JobStatusResponse>(
      `/feedback-summaries/jobs/${jobId}/status`
    );
    return data;
  },

  /**
   * Queue batch generation for multiple students
   */
  async batchQueueSummaries(
    evaluationId: number,
    studentIds: number[]
  ): Promise<BatchQueueResponse> {
    const { data } = await api.post<BatchQueueResponse>(
      `/feedback-summaries/evaluation/${evaluationId}/batch-queue`,
      { student_ids: studentIds }
    );
    return data;
  },

  /**
   * List all jobs for an evaluation
   */
  async listEvaluationJobs(
    evaluationId: number,
    status?: string
  ): Promise<{ evaluation_id: number; total: number; jobs: JobStatusResponse[] }> {
    const params = status ? { status } : {};
    const { data } = await api.get(
      `/feedback-summaries/evaluation/${evaluationId}/jobs`,
      { params }
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
