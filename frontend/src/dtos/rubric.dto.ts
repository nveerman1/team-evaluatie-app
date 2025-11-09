export type RubricListItem = {
  id: number;
  title: string;
  description?: string | null;
  scale_min: number;
  scale_max: number;
  scope: string; // "peer" | "project"
  metadata_json: Record<string, any>;
  criteria_count: number;
};

export type RubricListResponse = {
  items: RubricListItem[];
  page: number;
  limit: number;
  total: number;
};

export type RubricOut = {
  id: number;
  title: string;
  description?: string | null;
  scale_min: number;
  scale_max: number;
  scope: string; // "peer" | "project"
  metadata_json: Record<string, any>;
};

export type RubricCreate = {
  title: string;
  description?: string | null;
  scale_min?: number;
  scale_max?: number;
  scope?: string; // "peer" | "project"
  metadata_json?: Record<string, any>;
};

export type CriterionOut = {
  id: number;
  rubric_id: number;
  name: string;
  weight: number;
  descriptors: Record<string, string>;
  category?: string | null;
  order?: number | null;
  learning_objective_ids: number[];
};

export type CriterionUpsertItem = {
  id?: number | null;
  name: string;
  weight: number;
  descriptors: Record<string, string>;
  category?: string | null;
  order?: number | null;
  learning_objective_ids: number[];
};

export type CriterionBatchUpsertRequest = {
  items: CriterionUpsertItem[];
};

export type CriterionBatchUpsertResponse = {
  items: CriterionOut[];
};

export const EMPTY_DESCRIPTORS = {
  level1: "",
  level2: "",
  level3: "",
  level4: "",
  level5: "",
};
