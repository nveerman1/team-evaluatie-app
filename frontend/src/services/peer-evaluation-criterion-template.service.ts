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

export async function listPeerCriteria(
  subjectId: number
): Promise<PeerEvaluationCriterionTemplateDto[]> {
  const response = await api.get<PeerCriteriaListResponse>(
    `/templates/peer-criteria?subject_id=${subjectId}`
  );
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
