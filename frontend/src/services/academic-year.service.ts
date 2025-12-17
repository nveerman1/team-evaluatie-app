import api from "@/lib/api";
import {
  AcademicYear,
  AcademicYearListResponse,
  TransitionRequest,
  TransitionResult,
  ClassListResponse,
} from "@/dtos/academic-year.dto";

export const academicYearService = {
  /**
   * List academic years with pagination
   */
  async listAcademicYears(params?: {
    page?: number;
    per_page?: number;
  }): Promise<AcademicYearListResponse> {
    const response = await api.get<AcademicYearListResponse>(
      "/admin/academic-years",
      { params }
    );
    return response.data;
  },

  /**
   * Get a specific academic year
   */
  async getAcademicYear(id: number): Promise<AcademicYear> {
    const response = await api.get<AcademicYear>(`/admin/academic-years/${id}`);
    return response.data;
  },

  /**
   * Get classes for a specific academic year
   */
  async getClassesForYear(
    academicYearId: number,
    params?: {
      page?: number;
      per_page?: number;
    }
  ): Promise<ClassListResponse> {
    const response = await api.get<ClassListResponse>("/admin/classes", {
      params: {
        academic_year_id: academicYearId,
        ...params,
      },
    });
    return response.data;
  },

  /**
   * Execute academic year transition
   */
  async executeTransition(
    sourceYearId: number,
    request: TransitionRequest
  ): Promise<TransitionResult> {
    const response = await api.post<TransitionResult>(
      `/admin/academic-years/${sourceYearId}/transition`,
      request
    );
    return response.data;
  },
};
