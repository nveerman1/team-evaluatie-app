export type EvalStatus = "draft" | "open" | "closed";

export type Evaluation = {
  id: number;
  title: string;
  status: EvalStatus;
  rubric_id?: number | null;
  course_id?: number | null;
  deadlines?: { review?: string | null; reflection?: string | null } | null;
};

export type EvaluationListResponse = Evaluation[];
