import api from "@/lib/api";
import {
  RubricListResponse,
  RubricOut,
  CriterionOut,
} from "@/dtos/rubric.dto";

export const rubricService = {
  /**
   * Get list of rubrics with optional search and scope filter
   */
  async getRubrics(query?: string, scope?: string): Promise<RubricListResponse> {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (scope) params.set("scope", scope);
    const response = await api.get<RubricListResponse>(
      `/rubrics?${params.toString()}`,
    );
    return response.data;
  },

  /**
   * Get a single rubric by ID
   */
  async getRubric(id: number): Promise<RubricOut> {
    const response = await api.get<RubricOut>(`/rubrics/${id}`);
    return response.data;
  },

  /**
   * Get criteria for a rubric
   */
  async getCriteria(rubricId: number): Promise<CriterionOut[]> {
    const response = await api.get<CriterionOut[]>(
      `/rubrics/${rubricId}/criteria`,
    );
    return response.data || [];
  },
};
