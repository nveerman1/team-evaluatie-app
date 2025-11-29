import api from "@/lib/api";
import type {
  PeerEvaluationCriterionTemplateDto,
  PeerEvaluationCriterionTemplateCreateDto,
  PeerEvaluationCriterionTemplateUpdateDto,
} from "@/dtos/peer-evaluation-criterion-template.dto";

interface PeerCriteriaListResponse {
  templates: PeerEvaluationCriterionTemplateDto[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface ListPeerCriteriaOptions {
  target_level?: "onderbouw" | "bovenbouw" | null;
}

export async function listPeerCriteria(
  subjectId: number,
  options?: ListPeerCriteriaOptions
): Promise<PeerEvaluationCriterionTemplateDto[]> {
  let url = `/templates/peer-criteria?subject_id=${subjectId}`;
  if (options?.target_level) {
    url += `&target_level=${options.target_level}`;
  }
  const response = await api.get<PeerCriteriaListResponse>(url);
  return response.data.templates || [];
}

export async function createPeerCriterion(
  data: PeerEvaluationCriterionTemplateCreateDto
): Promise<PeerEvaluationCriterionTemplateDto> {
  const response = await api.post<PeerEvaluationCriterionTemplateDto>(
    `/templates/peer-criteria`,
    data
  );
  return response.data;
}

export async function updatePeerCriterion(
  id: number,
  data: PeerEvaluationCriterionTemplateUpdateDto
): Promise<PeerEvaluationCriterionTemplateDto> {
  const response = await api.patch<PeerEvaluationCriterionTemplateDto>(
    `/templates/peer-criteria/${id}`,
    data
  );
  return response.data;
}

export async function deletePeerCriterion(id: number): Promise<void> {
  await api.delete(`/templates/peer-criteria/${id}`);
}
