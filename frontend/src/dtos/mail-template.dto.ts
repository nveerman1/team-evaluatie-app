/**
 * DTOs for Mail Templates
 */

export type MailTemplateDto = {
  id: number;
  school_id: number;
  subject_id: number | null;
  name: string;
  type: string;
  subject: string;
  body: string;
  variables_allowed: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MailTemplateCreateDto = {
  subject_id?: number | null;
  name: string;
  type: string;
  subject: string;
  body: string;
  variables_allowed?: Record<string, unknown>;
  is_active?: boolean;
};

export type MailTemplateUpdateDto = {
  name?: string;
  type?: string;
  subject?: string;
  body?: string;
  variables_allowed?: Record<string, unknown>;
  is_active?: boolean;
};

export type MailTemplateListResponse = {
  templates: MailTemplateDto[];
  total: number;
  page: number;
  per_page: number;
};
