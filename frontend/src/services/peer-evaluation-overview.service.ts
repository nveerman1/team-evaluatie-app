import api from "@/lib/api";

export type PeerOverviewFilters = {
  courseId?: number;
  projectId?: number;
  period?: "3months" | "6months" | "year";
  studentName?: string;
};

export type FeedbackFilters = {
  courseId?: number;
  projectId?: number;
  category?: string;
  sentiment?: string;
  searchText?: string;
  riskOnly?: boolean;
};

export type OmzaTrendDataPoint = {
  date: string;
  organiseren: number;
  meedoen: number;
  zelfvertrouwen: number;
  autonomie: number;
};

export type OmzaCategoryScore = {
  current: number;
  trend: "up" | "down" | "neutral";
};

export type StudentHeatmapRow = {
  student_id: number;
  student_name: string;
  class_name: string | null;
  scores: {
    [key: string]: OmzaCategoryScore;
  };
  self_vs_peer_diff?: number;
};

export type KpiStudent = {
  student_id: number;
  student_name: string;
  value: number;
};

export type KpiData = {
  grootsteStijgers: KpiStudent[];
  grootsteDalers: KpiStudent[];
  structureelLaag: KpiStudent[];
  inconsistenties: KpiStudent[];
};

export type PeerOverviewDashboardResponse = {
  trendData: OmzaTrendDataPoint[];
  heatmapData: StudentHeatmapRow[];
  kpiData: KpiData;
};

export type FeedbackItem = {
  id: string;
  student_id: number;
  student_name: string;
  project_name: string;
  date: string;
  category: string;
  sentiment: string;
  text: string;
  keywords: string[];
  is_risk_behavior: boolean;
};

export type FeedbackCollectionResponse = {
  feedbackItems: FeedbackItem[];
  totalCount: number;
};

export const peerEvaluationOverviewService = {
  /**
   * Get peer evaluation dashboard data
   */
  async getDashboard(filters?: PeerOverviewFilters): Promise<PeerOverviewDashboardResponse> {
    const params = new URLSearchParams();
    
    if (filters?.courseId) params.set("course_id", String(filters.courseId));
    if (filters?.projectId) params.set("project_id", String(filters.projectId));
    if (filters?.period) params.set("period", filters.period);
    if (filters?.studentName) params.set("student_name", filters.studentName);
    
    const { data } = await api.get<PeerOverviewDashboardResponse>(
      `/overview/peer-evaluations/dashboard?${params.toString()}`
    );
    return data;
  },

  /**
   * Get feedback collection data
   */
  async getFeedback(filters?: FeedbackFilters): Promise<FeedbackCollectionResponse> {
    const params = new URLSearchParams();
    
    if (filters?.courseId) params.set("course_id", String(filters.courseId));
    if (filters?.projectId) params.set("project_id", String(filters.projectId));
    if (filters?.category) params.set("category", filters.category);
    if (filters?.sentiment) params.set("sentiment", filters.sentiment);
    if (filters?.searchText) params.set("search_text", filters.searchText);
    if (filters?.riskOnly) params.set("risk_only", String(filters.riskOnly));
    
    const { data } = await api.get<FeedbackCollectionResponse>(
      `/overview/peer-evaluations/feedback?${params.toString()}`
    );
    return data;
  },
};
