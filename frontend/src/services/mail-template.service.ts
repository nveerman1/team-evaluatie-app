import api from "@/lib/api";
import type {
  MailTemplateDto,
  MailTemplateCreateDto,
  MailTemplateUpdateDto,
  MailTemplateListResponse,
} from "@/dtos/mail-template.dto";

export interface ListMailTemplatesOptions {
  subject_id?: number | null;
  type?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
}

export async function listMailTemplates(
  options?: ListMailTemplatesOptions
): Promise<MailTemplateDto[]> {
  const params = new URLSearchParams();
  
  if (options?.subject_id !== undefined && options.subject_id !== null) {
    params.append("subject_id", options.subject_id.toString());
  }
  if (options?.type) {
    params.append("type", options.type);
  }
  if (options?.is_active !== undefined) {
    params.append("is_active", options.is_active.toString());
  }
  if (options?.page) {
    params.append("page", options.page.toString());
  }
  if (options?.per_page) {
    params.append("per_page", options.per_page.toString());
  }
  
  const url = `/templates/mail-templates${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await api.get<MailTemplateListResponse>(url);
  return response.data.templates || [];
}

export async function getMailTemplate(id: number): Promise<MailTemplateDto> {
  const response = await api.get<MailTemplateDto>(
    `/templates/mail-templates/${id}`
  );
  return response.data;
}

export async function createMailTemplate(
  data: MailTemplateCreateDto
): Promise<MailTemplateDto> {
  const response = await api.post<MailTemplateDto>(
    `/templates/mail-templates`,
    data
  );
  return response.data;
}

export async function updateMailTemplate(
  id: number,
  data: MailTemplateUpdateDto
): Promise<MailTemplateDto> {
  const response = await api.patch<MailTemplateDto>(
    `/templates/mail-templates/${id}`,
    data
  );
  return response.data;
}

export async function deleteMailTemplate(id: number): Promise<void> {
  await api.delete(`/templates/mail-templates/${id}`);
}
