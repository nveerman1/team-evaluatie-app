import api from "@/lib/api";
import {
  EvaluationListResponse,
  Evaluation,
  EvalStatus,
  EvaluationCreateDto, // zie dtos/evaluation.dto.ts (voeg toe als je 'm nog niet hebt)
  // Optional: als je een apart update-type hebt
  // EvaluationUpdateDto,
} from "@/dtos/evaluation.dto";

export const evaluationService = {
  /**
   * Lijst van evaluaties met optionele filters
   * - q?: string
   * - status?: string ('draft' | 'open' | 'closed' | 'archived')
   * - course_id?: number
   */
  async getEvaluations(params?: {
    q?: string;
    status?: string;
    course_id?: number;
  }): Promise<EvaluationListResponse> {
    const sp = new URLSearchParams();
    if (params?.q) sp.set("q", params.q);
    if (params?.status) sp.set("status", params.status);
    if (params?.course_id) sp.set("course_id", String(params.course_id));

    const { data } = await api.get<EvaluationListResponse>(
      `/evaluations${sp.size ? `?${sp.toString()}` : ""}`,
    );
    return data ?? [];
  },

  /**
   * Maak een nieuwe evaluatie aan
   * Backend accepteert: { title, rubric_id, course_id, settings?: { deadlines?: { review, reflection } } }
   */
  async createEvaluation(payload: EvaluationCreateDto): Promise<Evaluation> {
    const { data } = await api.post<Evaluation>("/evaluations", payload);
    return data;
  },

  /**
   * Update een bestaande evaluatie (titel/course_id/rubric/settings)
   * Als je een eigen DTO hebt, vervang 'payload' door EvaluationUpdateDto.
   */
  async updateEvaluation(
    id: number,
    payload: Partial<
      Pick<Evaluation, "title" | "rubric_id" | "course_id" | "settings">
    >,
  ): Promise<Evaluation> {
    const { data } = await api.put<Evaluation>(`/evaluations/${id}`, payload);
    return data;
  },

  /**
   * Update alleen de status
   */
  async updateStatus(id: number, status: EvalStatus): Promise<void> {
    await api.patch(`/evaluations/${id}/status`, { status });
  },

  /**
   * Haal één evaluatie op
   */
  async getEvaluation(id: number): Promise<Evaluation> {
    const { data } = await api.get<Evaluation>(`/evaluations/${id}`);
    return data;
  },
};
