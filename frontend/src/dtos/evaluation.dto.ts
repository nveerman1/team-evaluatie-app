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

// Team context types for evaluations
export interface EvaluationTeamMember {
  user_id: number;
  name: string;
  email: string;
  role: string | null;
  is_allocated: boolean;
}

export interface EvaluationTeam {
  team_id: number;
  team_number: number;
  display_name: string;
  member_count: number;
  members: EvaluationTeamMember[];
}

export interface EvaluationTeamContext {
  project_id: number | null;
  project_name: string | null;
  teams: EvaluationTeam[];
}

// Allocation with team information
export interface AllocationWithTeam {
  id: number;
  evaluator_id: number;
  evaluator_name: string | null;
  evaluator_team: number | null;
  evaluatee_id: number;
  evaluatee_name: string | null;
  evaluatee_team: number | null;
  status: "pending" | "completed";
}

export interface AllocationsWithTeamsResponse {
  allocations: AllocationWithTeam[];
}

