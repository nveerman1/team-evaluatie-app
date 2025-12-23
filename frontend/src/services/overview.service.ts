import api from "@/lib/api";
import {
  OverviewListResponse,
  OverviewFilters,
  OverviewMatrixResponse,
  MatrixFilters,
  ProjectOverviewListResponse,
  ProjectTrendResponse,
} from "@/dtos/overview.dto";

export const overviewService = {
  /**
   * Get all overview items with filters
   */
  async getAllItems(filters?: OverviewFilters): Promise<OverviewListResponse> {
    const params = new URLSearchParams();
    
    if (filters?.student_id) params.set("student_id", String(filters.student_id));
    if (filters?.course_id) params.set("course_id", String(filters.course_id));
    if (filters?.teacher_id) params.set("teacher_id", String(filters.teacher_id));
    if (filters?.type) params.set("type", filters.type);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.date_from) params.set("date_from", filters.date_from);
    if (filters?.date_to) params.set("date_to", filters.date_to);
    if (filters?.team_number) params.set("team_number", String(filters.team_number));
    if (filters?.search) params.set("search", filters.search);
    if (filters?.sort_by) params.set("sort_by", filters.sort_by);
    if (filters?.sort_order) params.set("sort_order", filters.sort_order);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.limit) params.set("limit", String(filters.limit));
    
    const { data } = await api.get<OverviewListResponse>(
      `/overview/all-items?${params.toString()}`
    );
    return data;
  },

  /**
   * Export overview items to CSV
   */
  async exportCSV(filters?: OverviewFilters): Promise<Blob> {
    const params = new URLSearchParams();
    
    if (filters?.student_id) params.set("student_id", String(filters.student_id));
    if (filters?.course_id) params.set("course_id", String(filters.course_id));
    if (filters?.teacher_id) params.set("teacher_id", String(filters.teacher_id));
    if (filters?.type) params.set("type", filters.type);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.date_from) params.set("date_from", filters.date_from);
    if (filters?.date_to) params.set("date_to", filters.date_to);
    if (filters?.team_number) params.set("team_number", String(filters.team_number));
    if (filters?.search) params.set("search", filters.search);
    
    const { data } = await api.get(
      `/overview/all-items/export.csv?${params.toString()}`,
      { responseType: "blob" }
    );
    return data;
  },

  /**
   * Get matrix view of all evaluations
   */
  async getMatrix(filters?: MatrixFilters): Promise<OverviewMatrixResponse> {
    const params = new URLSearchParams();
    
    if (filters?.course_id) params.set("course_id", String(filters.course_id));
    if (filters?.class_name) params.set("class_name", filters.class_name);
    if (filters?.student_name) params.set("student_name", filters.student_name);
    if (filters?.date_from) params.set("date_from", filters.date_from);
    if (filters?.date_to) params.set("date_to", filters.date_to);
    if (filters?.sort_by) params.set("sort_by", filters.sort_by);
    if (filters?.sort_order) params.set("sort_order", filters.sort_order);
    
    const { data } = await api.get<OverviewMatrixResponse>(
      `/overview/matrix${params.size ? `?${params.toString()}` : ""}`
    );
    return data;
  },

  /**
   * Export matrix to CSV
   */
  async exportMatrixCSV(filters?: MatrixFilters): Promise<Blob> {
    const params = new URLSearchParams();
    
    if (filters?.course_id) params.set("course_id", String(filters.course_id));
    if (filters?.class_name) params.set("class_name", filters.class_name);
    if (filters?.student_name) params.set("student_name", filters.student_name);
    if (filters?.date_from) params.set("date_from", filters.date_from);
    if (filters?.date_to) params.set("date_to", filters.date_to);
    if (filters?.sort_by) params.set("sort_by", filters.sort_by);
    if (filters?.sort_order) params.set("sort_order", filters.sort_order);
    
    const { data } = await api.get(
      `/overview/matrix/export.csv${params.size ? `?${params.toString()}` : ""}`,
      { responseType: "blob" }
    );
    return data;
  },

  /**
   * Get project overview data
   */
  async getProjectOverview(filters?: {
    schoolYear?: string;
    courseId?: string;
    period?: string;
    statusFilter?: string;
    searchQuery?: string;
  }): Promise<ProjectOverviewListResponse> {
    const params = new URLSearchParams();
    
    if (filters?.schoolYear) params.set("school_year", filters.schoolYear);
    if (filters?.courseId) params.set("course_id", filters.courseId);
    if (filters?.period) params.set("period", filters.period);
    if (filters?.statusFilter) params.set("status_filter", filters.statusFilter);
    if (filters?.searchQuery) params.set("search_query", filters.searchQuery);
    
    const { data } = await api.get<ProjectOverviewListResponse>(
      `/overview/projects?${params.toString()}`
    );
    return data;
  },

  /**
   * Get project trend data
   */
  async getProjectTrends(filters?: {
    schoolYear?: string;
    courseId?: string;
  }): Promise<ProjectTrendResponse> {
    const params = new URLSearchParams();
    
    if (filters?.schoolYear) params.set("school_year", filters.schoolYear);
    if (filters?.courseId) params.set("course_id", filters.courseId);
    
    const { data } = await api.get<ProjectTrendResponse>(
      `/overview/projects/trends?${params.toString()}`
    );
    return data;
  },

  /**
   * Get academic years for the school
   */
  async getAcademicYears(): Promise<Array<{label: string; id: number}>> {
    const { data } = await api.get<Array<{label: string; id: number}>>(
      `/overview/academic-years`
    );
    return data;
  },

  /**
   * Get courses for the school
   */
  async getCourses(): Promise<Array<{id: number; name: string}>> {
    const { data } = await api.get<Array<{id: number; name: string}>>(
      `/overview/courses`
    );
    return data;
  },
};
