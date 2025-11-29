// frontend/src/dtos/standard-remark.dto.ts

/**
 * DTOs for Standard Remarks (Quick Comments) feature
 */

export interface StandardRemarkDto {
  id: number;
  school_id: number;
  subject_id: number | null;
  type: string;  // "peer" | "project" | "competency" | "project_feedback" | "omza"
  category: string;  // For OMZA: "O" | "M" | "Z" | "A"
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
