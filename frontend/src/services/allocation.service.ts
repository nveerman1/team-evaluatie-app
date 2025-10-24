import api from "@/lib/api";
import { MyAllocation, ScoreItem } from "@/dtos/allocation.dto";

export const allocationService = {
  /**
   * Get my allocations for an evaluation
   */
  async getMyAllocations(evaluationId: number): Promise<MyAllocation[]> {
    const response = await api.get<MyAllocation[]>("/allocations/my", {
      params: { evaluation_id: evaluationId },
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  /**
   * Submit scores for an allocation
   */
  async submitScores(
    allocationId: number,
    items: ScoreItem[],
  ): Promise<void> {
    await api.post(`/allocations/${allocationId}/scores`, { items });
  },
};
