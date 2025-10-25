// src/lib/dto/cluster.dto.ts

/**
 * DTO representing a selectable cluster option.
 * Used in dropdowns (e.g. evaluations/create) where the teacher selects
 * a cluster that students belong to.
 */
export interface ClusterOptionDto {
  /** The unique value of the cluster (e.g. "GA2") */
  value: string;

  /** The display label of the cluster (often same as value) */
  label: string;
}

/**
 * Optional future DTO for a full cluster entity,
 * if you later want to manage clusters (e.g. admin CRUD).
 */
export interface ClusterDto {
  id?: number;
  name: string;
  school_id?: number;
  student_count?: number;
  created_at?: string;
  updated_at?: string;
}
