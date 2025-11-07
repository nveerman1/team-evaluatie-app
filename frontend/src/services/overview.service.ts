import api from "@/lib/api";
import {
  OverviewListResponse,
  OverviewFilters,
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
};
