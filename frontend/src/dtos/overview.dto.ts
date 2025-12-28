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

// ==================== Matrix View Types ====================

export interface MatrixCell {
  evaluation_id: number;
  type: "project" | "peer" | "competency";
  title: string;
  score?: number | null;
  status: string;
  date?: string | null;
  teacher_name?: string | null;
  detail_url: string;
}

export interface MatrixColumn {
  key: string;
  type: "project" | "peer" | "competency";
  title: string;
  date?: string | null;
  order: number;
}

export interface StudentMatrixRow {
  student_id: number;
  student_name: string;
  student_class?: string | null;
  cells: Record<string, MatrixCell | null>;
  average?: number | null;
}

export interface OverviewMatrixResponse {
  columns: MatrixColumn[];
  rows: StudentMatrixRow[];
  column_averages: Record<string, number | null>;
  total_students: number;
}

export interface MatrixFilters {
  course_id?: number;
  class_name?: string;
  student_name?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;  // Column key to sort by
  sort_order?: "asc" | "desc";
}

// ==================== Project Overview Types ====================

export interface CategoryStatistics {
  mean?: number | null;
  median?: number | null;
  p25?: number | null;  // 25th percentile
  p75?: number | null;  // 75th percentile
  p10?: number | null;  // 10th percentile (optional whisker)
  p90?: number | null;  // 90th percentile (optional whisker)
  min?: number | null;
  max?: number | null;
  iqr?: number | null;  // Interquartile range (P75 - P25)
  count_teams: number;
  count_assessments: number;
}

export interface ProjectOverviewItem {
  project_id: number;
  project_name: string;
  course_name?: string | null;
  client_name?: string | null;
  period_label: string;
  year: number;
  num_teams: number;
  average_score_overall?: number | null;
  average_scores_by_category: Record<string, number>;
  status: "active" | "completed";
  overall_statistics?: CategoryStatistics | null;
  category_statistics: Record<string, CategoryStatistics>;
}

export interface ProjectOverviewListResponse {
  projects: ProjectOverviewItem[];
  total: number;
}

export interface CategoryTrendData {
  project_label: string;
  project_id: number;  // For filtering/linking
  scores: Record<string, number>;  // category -> score (mean)
  statistics: Record<string, CategoryStatistics>;  // category -> statistics
}

export interface ProjectTrendResponse {
  trend_data: CategoryTrendData[];
}

export interface ProjectTeamScore {
  team_number: number;
  team_name?: string | null;
  team_members: string[];
  overall_score?: number | null;
  category_scores: Record<string, number>;
}

export interface ProjectTeamsResponse {
  project_id: number;
  project_name: string;
  teams: ProjectTeamScore[];
}
