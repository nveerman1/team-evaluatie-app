import api from "@/lib/api";

/* =========================================
   BACKEND RESPONSE TYPES
   ========================================= */

interface ProjectOverviewItemBackend {
  project_id: number | null;
  assessment_id: number;
  project_name: string;
  course_name: string | null;
  client_name: string | null;
  period_label: string;
  year: number;
  num_teams: number;
  average_score_overall: number | null;
  average_scores_by_category: Record<string, number>;
  status: "active" | "completed";
}

interface ProjectOverviewListResponseBackend {
  items: ProjectOverviewItemBackend[];
  total: number;
}

interface CategoryTrendDataPointBackend {
  project_label: string;
  scores: Record<string, number>;
}

interface ProjectTrendsResponseBackend {
  trends: CategoryTrendDataPointBackend[];
}

interface AiSummaryBackend {
  sterke_punten: string[];
  verbeter_punten: string[];
  algemene_trend: string;
}

interface ProjectAiSummaryResponseBackend {
  summary: AiSummaryBackend | null;
}

/* =========================================
   FRONTEND TYPES
   ========================================= */

export interface ProjectOverviewItem {
  projectId: number | null;
  assessmentId: number;
  projectName: string;
  courseName: string | null;
  clientName: string | null;
  periodLabel: string;
  year: number;
  numTeams: number;
  averageScoreOverall: number | null;
  averageScoresByCategory: Record<string, number>;
  status: "active" | "completed";
}

export interface ProjectOverviewListResponse {
  items: ProjectOverviewItem[];
  total: number;
}

export interface CategoryTrendDataPoint {
  projectLabel: string;
  scores: Record<string, number>;
}

export interface ProjectTrendsResponse {
  trends: CategoryTrendDataPoint[];
}

export interface AiSummary {
  sterkePunten: string[];
  verbeterPunten: string[];
  algemeneTrend: string;
}

export interface ProjectAiSummaryResponse {
  summary: AiSummary | null;
}

export interface ProjectOverviewFilters {
  schoolYear?: string;
  courseId?: string;
  period?: string;
  statusFilter?: string;
  searchQuery?: string;
}

/* =========================================
   SERVICE
   ========================================= */

export const projectOverviewService = {
  /**
   * Get list of projects with aggregated statistics
   */
  async getProjects(
    filters?: ProjectOverviewFilters
  ): Promise<ProjectOverviewListResponse> {
    const params = new URLSearchParams();

    if (filters?.schoolYear && filters.schoolYear !== "Alle schooljaren") {
      params.set("school_year", filters.schoolYear);
    }
    if (filters?.courseId && filters.courseId !== "") params.set("course_id", filters.courseId);
    if (filters?.period && filters.period !== "Alle periodes") params.set("period", filters.period);
    if (filters?.statusFilter && filters.statusFilter !== "all") params.set("status_filter", filters.statusFilter);
    if (filters?.searchQuery) params.set("search_query", filters.searchQuery);

    const queryString = params.toString();
    const url = queryString
      ? `/project-overview/projects?${queryString}`
      : "/project-overview/projects";

    const { data } = await api.get<ProjectOverviewListResponseBackend>(url);
    
    // Transform snake_case to camelCase for frontend
    return {
      items: data.items.map((item) => ({
        projectId: item.project_id,
        assessmentId: item.assessment_id,
        projectName: item.project_name,
        courseName: item.course_name,
        clientName: item.client_name,
        periodLabel: item.period_label,
        year: item.year,
        numTeams: item.num_teams,
        averageScoreOverall: item.average_score_overall,
        averageScoresByCategory: item.average_scores_by_category,
        status: item.status,
      })),
      total: data.total,
    };
  },

  /**
   * Get category trends across projects
   */
  async getTrends(
    filters?: ProjectOverviewFilters
  ): Promise<ProjectTrendsResponse> {
    const params = new URLSearchParams();

    if (filters?.schoolYear && filters.schoolYear !== "Alle schooljaren") {
      params.set("school_year", filters.schoolYear);
    }
    if (filters?.courseId && filters.courseId !== "") params.set("course_id", filters.courseId);
    if (filters?.period && filters.period !== "Alle periodes") params.set("period", filters.period);

    const queryString = params.toString();
    const url = queryString
      ? `/project-overview/trends?${queryString}`
      : "/project-overview/trends";

    const { data } = await api.get<ProjectTrendsResponseBackend>(url);
    
    // Transform snake_case to camelCase
    return {
      trends: data.trends.map((trend) => ({
        projectLabel: trend.project_label,
        scores: trend.scores,
      })),
    };
  },

  /**
   * Get AI-generated summary of project feedback
   */
  async getAiSummary(
    filters?: ProjectOverviewFilters
  ): Promise<ProjectAiSummaryResponse> {
    const params = new URLSearchParams();

    if (filters?.schoolYear) params.set("school_year", filters.schoolYear);
    if (filters?.courseId && filters.courseId !== "") params.set("course_id", filters.courseId);
    if (filters?.period) params.set("period", filters.period);

    const queryString = params.toString();
    const url = queryString
      ? `/project-overview/ai-summary?${queryString}`
      : "/project-overview/ai-summary";

    const { data } = await api.get<ProjectAiSummaryResponseBackend>(url);
    
    // Transform snake_case to camelCase
    if (data.summary) {
      return {
        summary: {
          sterkePunten: data.summary.sterke_punten,
          verbeterPunten: data.summary.verbeter_punten,
          algemeneTrend: data.summary.algemene_trend,
        },
      };
    }
    
    return { summary: null };
  },
};
