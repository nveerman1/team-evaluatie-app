// frontend/src/dtos/omza.dto.ts

/**
 * DTOs for OMZA (Organiseren, Meedoen, Zelfvertrouwen, Autonomie) feature
 */

export interface OmzaCategoryScore {
  peer_avg: number | null;
  self_avg: number | null;
  teacher_score: number | null;
}

export interface OmzaStudentData {
  student_id: number;
  student_name: string;
  class_name?: string | null;
  team_number?: number | null;
  category_scores: Record<string, OmzaCategoryScore>;
  teacher_comment?: string | null;
}

export interface OmzaDataResponse {
  evaluation_id: number;
  students: OmzaStudentData[];
  categories: string[];
}

export interface TeacherScoreCreate {
  student_id: number;
  category: string;
  score: number;
}

export interface TeacherCommentCreate {
  student_id: number;
  comment: string;
}

export interface StandardComment {
  id: string;
  category: string;
  text: string;
}

export interface StandardCommentCreate {
  category: string;
  text: string;
}
