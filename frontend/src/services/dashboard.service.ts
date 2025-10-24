import api from "@/lib/api";
import {
  DashboardResponse,
  FlagsResponse,
  GradePreviewResponse,
} from "@/dtos/dashboard.dto";

export const dashboardService = {
  /**
   * Get dashboard data for an evaluation
   */
  async getDashboard(
    evaluationId: number,
    includeBreakdown?: boolean,
  ): Promise<DashboardResponse> {
    const response = await api.get<DashboardResponse>(
      `/dashboard/evaluation/${evaluationId}`,
      {
        params: includeBreakdown ? { include_breakdown: true } : undefined,
      },
    );
    return response.data;
  },

  /**
   * Get flags for an evaluation
   */
  async getFlags(evaluationId: number): Promise<FlagsResponse> {
    const response = await api.get<FlagsResponse>(
      `/flags/evaluation/${evaluationId}`,
    );
    return response.data;
  },

  /**
   * Get grade preview
   */
  async getGradePreview(evaluationId: number): Promise<GradePreviewResponse> {
    const response = await api.post<GradePreviewResponse>(`/grades/preview`, {
      evaluation_id: evaluationId,
    });
    return response.data;
  },
};
