// frontend/src/dtos/evaluation.dto.ts
export type EvalStatus = "draft" | "open" | "closed"; // align met backend

export type Evaluation = {
  id: number;
  title: string;
  rubric_id: number;
  cluster: string; // <-- BELANGRIJK: string, bv "GA2"
  status: EvalStatus;
  created_at: string; // ISO
  settings?: {
    deadlines?: {
      review?: string; // "YYYY-MM-DD"
      reflection?: string; // "YYYY-MM-DD"
    };
  };
  deadlines?: {
    review?: string;
    reflection?: string;
  };
};

// Request voor create
export type EvaluationCreateDto = {
  title: string;
  rubric_id: number;
  cluster: string; // bv "GA2"
  settings?: {
    deadlines?: {
      review?: string;
      reflection?: string;
    };
  };
};

export type EvaluationListResponse = Evaluation[];
