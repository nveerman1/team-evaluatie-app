// frontend/src/dtos/evaluation.dto.ts
export type EvalStatus = "draft" | "open" | "closed" | "published"; // align met backend
export type EvaluationType = "peer" | "project" | "competency";

export type Evaluation = {
  id: number;
  title: string;
  rubric_id: number;
  course_id: number;
  project_id?: number | null;
  project_team_id?: number | null; // Link to frozen roster
  cluster: string; // kept for backward compatibility (populated from course_name)
  evaluation_type: EvaluationType;
  status: EvalStatus;
  created_at: string; // ISO
  closed_at?: string | null; // ISO - when evaluation was closed/locked
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
  project_team_id?: number | null; // Optional link to project team roster
  settings?: {
    deadlines?: {
      review?: string;
      reflection?: string;
    };
  };
};

export type EvaluationListResponse = Evaluation[];
