export interface ProjectRubricCriterionTemplateDto {
  id: number;
  school_id: number;
  subject_id: number;
  category: "projectproces" | "eindresultaat" | "communicatie";
  title: string;
  description: string | null;
  target_level: "onderbouw" | "bovenbouw" | null;
  level_descriptors: {
    "1": string;
    "2": string;
    "3": string;
    "4": string;
    "5": string;
  };
  learning_objective_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface ProjectRubricCriterionTemplateCreateDto {
  subject_id: number;
  category: "projectproces" | "eindresultaat" | "communicatie";
  title: string;
  description?: string | null;
  target_level?: "onderbouw" | "bovenbouw" | null;
  level_descriptors: {
    "1": string;
    "2": string;
    "3": string;
    "4": string;
    "5": string;
  };
  learning_objective_ids?: number[];
}

export interface ProjectRubricCriterionTemplateUpdateDto {
  category?: "projectproces" | "eindresultaat" | "communicatie";
  title?: string;
  description?: string | null;
  target_level?: "onderbouw" | "bovenbouw" | null;
  level_descriptors?: {
    "1": string;
    "2": string;
    "3": string;
    "4": string;
    "5": string;
  };
  learning_objective_ids?: number[];
}
