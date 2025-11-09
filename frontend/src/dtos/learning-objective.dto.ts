export interface LearningObjectiveDto {
  id: number;
  domain: string | null;
  title: string;
  description: string | null;
  level: string | null;
  order: number;
  active: boolean;
  metadata_json: Record<string, unknown>;
}

export interface LearningObjectiveCreateDto {
  domain?: string | null;
  title: string;
  description?: string | null;
  level?: string | null;
  order?: number;
  active?: boolean;
  metadata_json?: Record<string, unknown>;
}

export interface LearningObjectiveUpdateDto {
  domain?: string | null;
  title?: string;
  description?: string | null;
  level?: string | null;
  order?: number;
  active?: boolean;
  metadata_json?: Record<string, unknown>;
}

export interface LearningObjectiveListResponse {
  items: LearningObjectiveDto[];
  page: number;
  limit: number;
  total: number;
}

export interface LearningObjectiveImportItem {
  domain?: string | null;
  title: string;
  description?: string | null;
  level?: string | null;
  order?: number;
  active?: boolean;
}

export interface LearningObjectiveImportRequest {
  items: LearningObjectiveImportItem[];
}

export interface LearningObjectiveImportResponse {
  created: number;
  updated: number;
  errors: string[];
}

// Overview / Progress DTOs

export interface StudentLearningObjectiveProgress {
  learning_objective_id: number;
  learning_objective_title: string;
  domain: string | null;
  average_score: number | null;
  assessment_count: number;
  assessments: Array<Record<string, unknown>>;
}

export interface StudentLearningObjectiveOverview {
  user_id: number;
  user_name: string;
  class_name: string | null;
  objectives: StudentLearningObjectiveProgress[];
}

export interface LearningObjectiveOverviewResponse {
  students: StudentLearningObjectiveOverview[];
  filters: Record<string, unknown>;
}
