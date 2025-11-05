export type DashboardRow = {
  user_id: number;
  user_name: string;
  peer_avg_overall: number;
  self_avg_overall?: number | null;
  reviewers_count: number;
  gcf: number;
  spr: number;
  suggested_grade: number;
};

export type DashboardResponse = {
  evaluation_id: number;
  rubric_id: number;
  rubric_scale_min: number;
  rubric_scale_max: number;
  criteria: { id: number; name: string; weight: number }[];
  items: DashboardRow[];
};

export type FlagsResponse = {
  evaluation_id: number;
  items: {
    user_id: number;
    user_name: string;
    spr: number;
    gcf: number;
    reviewers_count: number;
    flags: {
      code: string;
      severity: "low" | "medium" | "high";
      message: string;
    }[];
  }[];
};

export type GradePreviewResponse = {
  evaluation_id: number;
  items: {
    user_id: number;
    user_name: string;
    avg_score: number;
    gcf: number;
    spr: number;
    suggested_grade: number;
  }[];
};

export type StudentProgressRow = {
  user_id: number;
  user_name: string;
  class_name?: string | null;
  team_number?: number | null;
  self_assessment_status: "completed" | "partial" | "not_started";
  peer_reviews_given: number;
  peer_reviews_given_expected: number;
  peer_reviews_received: number;
  peer_reviews_expected: number;
  reflection_status: "completed" | "not_started";
  reflection_word_count?: number | null;
  total_progress_percent: number;
  last_activity?: string | null;
  flags: string[];
};

export type StudentProgressResponse = {
  evaluation_id: number;
  total_students: number;
  items: StudentProgressRow[];
};

export type StudentProgressKPIs = {
  evaluation_id: number;
  total_students: number;
  self_reviews_completed: number;
  peer_reviews_total: number;
  reflections_completed: number;
};
