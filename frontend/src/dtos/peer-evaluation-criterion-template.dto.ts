export interface PeerEvaluationCriterionTemplateDto {
  id: number;
  school_id: number;
  subject_id: number;
  omza_category: "organiseren" | "meedoen" | "zelfvertrouwen" | "autonomie";
  title: string;
  description: string | null;
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

export interface PeerEvaluationCriterionTemplateCreateDto {
  subject_id: number;
  omza_category: "organiseren" | "meedoen" | "zelfvertrouwen" | "autonomie";
  title: string;
  description?: string | null;
  level_descriptors: {
    "1": string;
    "2": string;
    "3": string;
    "4": string;
    "5": string;
  };
  learning_objective_ids?: number[];
}

export interface PeerEvaluationCriterionTemplateUpdateDto {
  omza_category?: "organiseren" | "meedoen" | "zelfvertrouwen" | "autonomie";
  title?: string;
  description?: string | null;
  level_descriptors?: {
    "1": string;
    "2": string;
    "3": string;
    "4": string;
    "5": string;
  };
  learning_objective_ids?: number[];
}
