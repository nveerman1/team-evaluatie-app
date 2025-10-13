export type RubricListItem = {
  id: number;
  title: string;
  description?: string | null;
  scale_min: number;
  scale_max: number;
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
  metadata_json: Record<string, any>;
};

export type RubricCreate = {
  title: string;
  description?: string | null;
  scale_min?: number; // default 1
  scale_max?: number; // default 5
  metadata_json?: Record<string, any>;
};

export type CriterionOut = {
  id: number;
  rubric_id: number;
  name: string;
  weight: number;
  descriptors: Record<string, string>; // level1..level5
  order?: number | null;
};

export type CriterionUpsertItem = {
  id?: number | null;
  name: string;
  weight: number;
  descriptors: Record<string, string>;
  order?: number | null;
};

export type CriterionBatchUpsertRequest = {
  items: CriterionUpsertItem[];
};

export type CriterionBatchUpsertResponse = {
  items: CriterionOut[];
};

// Helpers
export const EMPTY_DESCRIPTORS = {
  level1: "",
  level2: "",
  level3: "",
  level4: "",
  level5: "",
};
