export type MyAllocation = {
  allocation_id: number;
  evaluation_id: number;
  reviewee_id: number;
  reviewee_name: string;
  reviewee_email: string;
  is_self: boolean;
  rubric_id: number;
  criterion_ids: number[];
};

export type Criterion = {
  id: number;
  rubric_id: number;
  name: string;
  weight: number;
  descriptors: Record<string, string>;
};

export type ScoreItem = {
  criterion_id: number;
  score: number;
  comment?: string;
};
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
