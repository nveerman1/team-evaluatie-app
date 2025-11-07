/**
 * DTOs for Teacher Overview Page
 */

export interface OverviewItem {
  id: number;
  type: "project" | "peer" | "competency";
  
  // Student info
  student_id: number;
  student_name: string;
  student_class?: string | null;
  
  // Item info
  title: string;
  course_name?: string | null;
  course_id?: number | null;
  teacher_name?: string | null;
  teacher_id?: number | null;
  date?: string | null;  // ISO date
  
  // Score
  score?: number | null;
  score_label?: string | null;
  
  // Status
  status: string;
  
  // Navigation
  detail_url: string;
  
  // Optional metadata
  team_number?: number | null;
  team_name?: string | null;
}

export interface OverviewListResponse {
  items: OverviewItem[];
  total: number;
  page: number;
  limit: number;
  total_projects: number;
  total_peers: number;
  total_competencies: number;
}

export interface OverviewFilters {
  student_id?: number;
  course_id?: number;
  teacher_id?: number;
  type?: "project" | "peer" | "competency";
  status?: string;
  date_from?: string;  // ISO date
  date_to?: string;    // ISO date
  team_number?: number;
  search?: string;
  sort_by?: "date" | "student" | "score";
  sort_order?: "asc" | "desc";
  page?: number;
  limit?: number;
}
