// frontend/src/dtos/evaluation.dto.ts
export type EvalStatus = "draft" | "open" | "closed"; // align met backend
export type EvaluationType = "peer" | "project" | "competency";

export type Evaluation = {
  id: number;
  title: string;
  rubric_id: number;
  course_id: number;
  project_id?: number | null;
  cluster: string; // kept for backward compatibility (populated from course_name)
  evaluation_type: EvaluationType;
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
  course_id: number;
  project_id?: number | null;
  settings?: {
    deadlines?: {
      review?: string;
      reflection?: string;
    };
  };
};

export type EvaluationListResponse = Evaluation[];
