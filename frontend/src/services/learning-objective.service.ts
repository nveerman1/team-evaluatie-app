import api from "@/lib/api";
import {
  LearningObjectiveDto,
  LearningObjectiveCreateDto,
  LearningObjectiveUpdateDto,
  LearningObjectiveListResponse,
  LearningObjectiveImportRequest,
  LearningObjectiveImportResponse,
  LearningObjectiveOverviewResponse,
} from "@/dtos/learning-objective.dto";

// ============ CRUD Operations ============

export async function createLearningObjective(
  data: LearningObjectiveCreateDto
): Promise<LearningObjectiveDto> {
  const response = await api.post<LearningObjectiveDto>(
    `/learning-objectives`,
    data
  );
  return response.data;
}

export async function listLearningObjectives(
  params?: {
    page?: number;
    limit?: number;
    domain?: string;
    level?: string;
    active?: boolean;
    search?: string;
  }
): Promise<LearningObjectiveListResponse> {
  const response = await api.get<LearningObjectiveListResponse>(
    `/learning-objectives`,
    { params }
  );
  return response.data;
}

export async function getLearningObjective(
  id: number
): Promise<LearningObjectiveDto> {
  const response = await api.get<LearningObjectiveDto>(
    `/learning-objectives/${id}`
  );
  return response.data;
}

export async function updateLearningObjective(
  id: number,
  data: LearningObjectiveUpdateDto
): Promise<LearningObjectiveDto> {
  const response = await api.put<LearningObjectiveDto>(
    `/learning-objectives/${id}`,
    data
  );
  return response.data;
}

export async function deleteLearningObjective(
  id: number
): Promise<void> {
  await api.delete(`/learning-objectives/${id}`);
}

// ============ Import ============

export async function importLearningObjectives(
  data: LearningObjectiveImportRequest
): Promise<LearningObjectiveImportResponse> {
  const response = await api.post<LearningObjectiveImportResponse>(
    `/learning-objectives/import`,
    data
  );
  return response.data;
}

// ============ Overview ============

export async function getLearningObjectivesOverview(
  params?: {
    class_name?: string;
    course_id?: number;
    evaluation_id?: number;
    learning_objective_id?: number;
  }
): Promise<LearningObjectiveOverviewResponse> {
  const response = await api.get<LearningObjectiveOverviewResponse>(
    `/learning-objectives/overview/students`,
    { params }
  );
  return response.data;
}
