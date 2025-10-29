import api from "@/lib/api";
import {
  DashboardResponse,
  FlagsResponse,
  GradePreviewResponse,
  StudentProgressResponse,
  StudentProgressKPIs,
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
   * Get grade preview (POST is primair; bij 405 fallback naar GET)
   */
  async getGradePreview(evaluationId: number): Promise<GradePreviewResponse> {
    try {
      // ✅ Jouw backend: GET met ?evaluation_id=...
      const res = await api.get<GradePreviewResponse>("/grades/preview", {
        params: { evaluation_id: evaluationId },
      });
      return res.data;
    } catch (e: any) {
      // Sommige branches hadden POST; alleen bij 405 proberen we POST
      if (e?.response?.status === 405) {
        const res = await api.post<GradePreviewResponse>("/grades/preview", {
          evaluation_id: evaluationId,
        });
        return res.data;
      }
      throw e;
    }
  },

  /**
   * Get student progress for an evaluation
   */
  async getStudentProgress(
    evaluationId: number,
  ): Promise<StudentProgressResponse> {
    const response = await api.get<StudentProgressResponse>(
      `/dashboard/evaluation/${evaluationId}/progress`,
    );
    return response.data;
  },

  /**
   * Get KPIs for an evaluation
   */
  async getKPIs(evaluationId: number): Promise<StudentProgressKPIs> {
    const response = await api.get<StudentProgressKPIs>(
      `/dashboard/evaluation/${evaluationId}/kpis`,
    );
    return response.data;
  },

  /**
   * Export student progress as CSV
   */
  async exportProgressCSV(evaluationId: number): Promise<Blob> {
    const response = await api.get(
      `/dashboard/evaluation/${evaluationId}/progress/export.csv`,
      {
        responseType: "blob",
      },
    );
    return response.data;
  },
};
