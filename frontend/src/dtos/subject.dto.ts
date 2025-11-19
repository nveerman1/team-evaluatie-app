/**
 * Subject DTOs
 * 
 * Subject (NL: sectie) is an organizational level between School and Course.
 * Examples: "Onderzoek & Ontwerpen", "Biologie", "Nederlands"
 */

export type Subject = {
  id: number;
  school_id: number;
  name: string;
  code: string;
  color?: string;
  icon?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SubjectCreate = {
  name: string;
  code: string;
  color?: string;
  icon?: string;
};

export type SubjectUpdate = {
  name?: string;
  code?: string;
  color?: string;
  icon?: string;
  is_active?: boolean;
};

export type SubjectListResponse = {
  subjects: Subject[];
  total: number;
  page: number;
  per_page: number;
};
