// frontend/src/dtos/standard-remark.dto.ts

/**
 * DTOs for Standard Remarks (Quick Comments) feature
 * 
 * Standard remarks support different types (e.g., "omza", "peer", "project") and 
 * categories specific to each type. For OMZA type, categories are O/M/Z/A.
 * For other types, categories may be "positief", "aandachtspunt", "aanbeveling".
 */

export interface StandardRemarkDto {
  id: number;
  school_id: number;
  subject_id: number | null;
  type: string;  // "peer" | "project" | "competency" | "project_feedback" | "omza"
  category: string;  // For OMZA: "O" | "M" | "Z" | "A"; For others: "positief" | "aandachtspunt" | "aanbeveling"
  text: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface StandardRemarkCreateDto {
  subject_id?: number | null;
  type: string;
  category: string;
  text: string;
  order?: number;
}

export interface StandardRemarkUpdateDto {
  type?: string;
  category?: string;
  text?: string;
  order?: number;
}

export interface StandardRemarkListResponse {
  remarks: StandardRemarkDto[];
  total: number;
  page: number;
  per_page: number;
}
