export type GradePreviewItem = {
  user_id: number;
  user_name: string;
  avg_score: number; // 0..100
  gcf: number; // group correction factor
  spr: number; // self/peer ratio
  suggested_grade: number; // 1..10
  team_number?: number | null;
  class_name?: string | null;
};

export type GradePreviewResponse = {
  evaluation_id: number;
  items: GradePreviewItem[];
};

export type PublishedGradeOut = {
  evaluation_id: number;
  user_id: number;
  user_name: string;
  grade: number | null; // 1–10 of null (concept)
  reason: string | null;
  meta: Record<string, any>;
};

export type GradeOverrideIn = {
  grade?: number | null; // 1–10 of null
  reason?: string | null;
  rowGroupGrade?: number | null;
};

export type GradeDraftRequest = {
  evaluation_id: number;
  group_grade?: number | null; // 1–10
  overrides: Record<number, GradeOverrideIn>;
};

export type GradePublishRequest = GradeDraftRequest;
