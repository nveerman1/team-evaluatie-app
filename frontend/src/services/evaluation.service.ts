import api from "@/lib/api";
import {
  EvaluationListResponse,
  Evaluation,
  EvalStatus,
} from "@/dtos/evaluation.dto";

export const evaluationService = {
  /**
   * Get list of evaluations with optional filters
   */
  async getEvaluations(params?: {
    q?: string;
    status?: string;
    course_id?: string;
  }): Promise<EvaluationListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set("q", params.q);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.course_id) searchParams.set("course_id", params.course_id);

    const response = await api.get<EvaluationListResponse>(
      `/evaluations${searchParams.size ? `?${searchParams.toString()}` : ""}`,
    );
    return response.data ?? [];
  },

  /**
   * Update evaluation status
   */
  async updateStatus(
    id: number,
    status: EvalStatus,
  ): Promise<void> {
    await api.patch(`/evaluations/${id}/status`, { status });
  },

  /**
   * Get a single evaluation by ID
   */
  async getEvaluation(id: number): Promise<Evaluation> {
    const response = await api.get<Evaluation>(`/evaluations/${id}`);
    return response.data;
  },
};
