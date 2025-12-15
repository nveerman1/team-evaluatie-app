import api from "@/lib/api";

/* =========================================
   TYPES
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

    if (filters?.schoolYear) params.set("school_year", filters.schoolYear);
    if (filters?.courseId) params.set("course_id", filters.courseId);
    if (filters?.period) params.set("period", filters.period);
    if (filters?.statusFilter) params.set("status_filter", filters.statusFilter);
    if (filters?.searchQuery) params.set("search_query", filters.searchQuery);

    const queryString = params.toString();
    const url = queryString
      ? `/project-overview/projects?${queryString}`
      : "/project-overview/projects";

    const { data } = await api.get<ProjectOverviewListResponse>(url);
    
    // Transform snake_case to camelCase for frontend
    return {
      items: data.items.map((item: any) => ({
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

    if (filters?.schoolYear) params.set("school_year", filters.schoolYear);
    if (filters?.courseId) params.set("course_id", filters.courseId);
    if (filters?.period) params.set("period", filters.period);

    const queryString = params.toString();
    const url = queryString
      ? `/project-overview/trends?${queryString}`
      : "/project-overview/trends";

    const { data } = await api.get<ProjectTrendsResponse>(url);
    
    // Transform snake_case to camelCase
    return {
      trends: data.trends.map((trend: any) => ({
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
    if (filters?.courseId) params.set("course_id", filters.courseId);
    if (filters?.period) params.set("period", filters.period);

    const queryString = params.toString();
    const url = queryString
      ? `/project-overview/ai-summary?${queryString}`
      : "/project-overview/ai-summary";

    const { data } = await api.get<ProjectAiSummaryResponse>(url);
    
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
