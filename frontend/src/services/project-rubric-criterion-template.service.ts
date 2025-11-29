import api from "@/lib/api";
import type {
  ProjectRubricCriterionTemplateDto,
  ProjectRubricCriterionTemplateCreateDto,
  ProjectRubricCriterionTemplateUpdateDto,
} from "@/dtos/project-rubric-criterion-template.dto";

interface ProjectRubricCriteriaListResponse {
  templates: ProjectRubricCriterionTemplateDto[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface ListProjectRubricCriteriaOptions {
  target_level?: "onderbouw" | "bovenbouw" | null;
  category?: "projectproces" | "eindresultaat" | "communicatie";
}

export async function listProjectRubricCriteria(
  subjectId: number,
  options?: ListProjectRubricCriteriaOptions
): Promise<ProjectRubricCriterionTemplateDto[]> {
  let url = `/templates/project-rubric-criteria?subject_id=${subjectId}`;
  if (options?.target_level) {
    url += `&target_level=${options.target_level}`;
  }
  if (options?.category) {
    url += `&category=${options.category}`;
  }
  const response = await api.get<ProjectRubricCriteriaListResponse>(url);
  return response.data.templates || [];
}

export async function createProjectRubricCriterion(
  data: ProjectRubricCriterionTemplateCreateDto
): Promise<ProjectRubricCriterionTemplateDto> {
  const response = await api.post<ProjectRubricCriterionTemplateDto>(
    `/templates/project-rubric-criteria`,
    data
  );
  return response.data;
}

export async function updateProjectRubricCriterion(
  id: number,
  data: ProjectRubricCriterionTemplateUpdateDto
): Promise<ProjectRubricCriterionTemplateDto> {
  const response = await api.patch<ProjectRubricCriterionTemplateDto>(
    `/templates/project-rubric-criteria/${id}`,
    data
  );
  return response.data;
}

export async function deleteProjectRubricCriterion(id: number): Promise<void> {
  await api.delete(`/templates/project-rubric-criteria/${id}`);
}
