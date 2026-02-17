/**
 * DTOs for Skill Trainings (Vaardigheidstrainingen)
 */

// ============ Status Types ============

export type SkillTrainingStatus = 
  | "none" 
  | "planned" 
  | "in_progress" 
  | "submitted" 
  | "completed" 
  | "mastered";

export const STUDENT_ALLOWED_STATUSES: SkillTrainingStatus[] = [
  "none",
  "planned", 
  "in_progress",
  "submitted"
];

// Status metadata for UI display
export const STATUS_META: Record<SkillTrainingStatus, { label: string; colorClass: string }> = {
  none: { label: "Niet gestart", colorClass: "bg-gray-100 text-gray-800" },
  planned: { label: "Gepland", colorClass: "bg-blue-100 text-blue-800" },
  in_progress: { label: "Bezig", colorClass: "bg-yellow-100 text-yellow-800" },
  submitted: { label: "Ingeleverd", colorClass: "bg-purple-100 text-purple-800" },
  completed: { label: "Voltooid", colorClass: "bg-green-100 text-green-800" },
  mastered: { label: "Beheerst", colorClass: "bg-emerald-100 text-emerald-800" },
};

// ============ Skill Training DTOs ============

export interface SkillTraining {
  id: number;
  school_id: number;
  title: string;
  url: string;
  competency_category_id: number;
  learning_objective_id?: number;
  level?: string; // "basis" | "plus"
  est_minutes?: string; // e.g., "10-15 min"
  is_active: boolean;
  competency_category_name?: string;
  learning_objective_title?: string;
  created_at: string;
  updated_at: string;
}

export interface SkillTrainingCreate {
  title: string;
  url: string;
  competency_category_id: number;
  learning_objective_id?: number;
  level?: string;
  est_minutes?: string;
  is_active: boolean;
}

export interface SkillTrainingUpdate {
  title?: string;
  url?: string;
  competency_category_id?: number;
  learning_objective_id?: number;
  level?: string;
  est_minutes?: string;
  is_active?: boolean;
}

// ============ Progress DTOs ============

export interface SkillTrainingProgress {
  id: number;
  student_id: number;
  training_id: number;
  course_id: number;
  status: SkillTrainingStatus;
  note?: string;
  updated_at: string;
  updated_by_user_id: number;
}

export interface StudentProgressRow {
  student_id: number;
  student_name: string;
  class_name?: string;
  progress: Record<number, SkillTrainingStatus>; // training_id -> status
}

export interface TeacherProgressMatrixResponse {
  trainings: SkillTraining[];
  students: StudentProgressRow[];
}

export interface BulkProgressUpdate {
  student_ids: number[];
  training_ids: number[];
  status: SkillTrainingStatus;
}

// ============ Student DTOs ============

export interface StudentTrainingItem {
  training: SkillTraining;
  status: SkillTrainingStatus;
  note?: string;
  updated_at?: string;
}

export interface StudentTrainingListResponse {
  items: StudentTrainingItem[];
}

export interface StudentStatusUpdate {
  status: SkillTrainingStatus;
  note?: string;
}
