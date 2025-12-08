// frontend/src/dtos/project-notes.dto.ts

/**
 * DTOs for the Project Notes feature
 */

export interface ProjectNotesContextCreate {
  title: string;
  project_id?: number | null;
  course_id?: number | null;
  class_name?: string | null;
  description?: string | null;
  evaluation_id?: number | null;
  settings?: Record<string, any>;
}

export interface ProjectNotesContextUpdate {
  title?: string;
  description?: string;
  settings?: Record<string, any>;
}

export interface ProjectNotesContext {
  id: number;
  title: string;
  project_id?: number | null;
  course_id?: number | null;
  course_name?: string | null;
  class_name?: string | null;
  description?: string | null;
  evaluation_id?: number | null;
  created_by: number;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  settings: Record<string, any>;
  note_count?: number;
}

export interface TeamInfo {
  id: number;
  name: string;
  team_number?: number | null;
  member_count: number;
  members: string[];
  member_ids: number[];
}

export interface StudentInfo {
  id: number;
  name: string;
  team_id?: number | null;
  team_name?: string | null;
}

export interface ProjectNotesContextDetail extends ProjectNotesContext {
  teams: TeamInfo[];
  students: StudentInfo[];
}

export interface ProjectNoteCreate {
  note_type: "project" | "team" | "student";
  team_id?: number | null;
  student_id?: number | null;
  text: string;
  tags?: string[];
  omza_category?: string | null;
  learning_objective_id?: number | null;
  is_competency_evidence?: boolean;
  is_portfolio_evidence?: boolean;
  metadata?: Record<string, any>;
}

export interface ProjectNoteUpdate {
  text?: string;
  tags?: string[];
  omza_category?: string | null;
  learning_objective_id?: number | null;
  is_competency_evidence?: boolean;
  is_portfolio_evidence?: boolean;
  metadata?: Record<string, any>;
}

export interface ProjectNote {
  id: number;
  context_id: number;
  note_type: "project" | "team" | "student";
  team_id?: number | null;
  team_name?: string | null;
  student_id?: number | null;
  student_name?: string | null;
  text: string;
  tags: string[];
  omza_category?: string | null;
  learning_objective_id?: number | null;
  learning_objective_title?: string | null;
  is_competency_evidence: boolean;
  is_portfolio_evidence: boolean;
  metadata: Record<string, any>;
  created_by: number;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}
