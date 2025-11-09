import axios from "axios";
import {
  LearningObjectiveDto,
  LearningObjectiveCreateDto,
  LearningObjectiveUpdateDto,
  LearningObjectiveListResponse,
  LearningObjectiveImportRequest,
  LearningObjectiveImportResponse,
  LearningObjectiveOverviewResponse,
} from "@/dtos/learning-objective.dto";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// ============ CRUD Operations ============

export async function createLearningObjective(
  data: LearningObjectiveCreateDto,
  userEmail: string
): Promise<LearningObjectiveDto> {
  const response = await axios.post(
    `${API_BASE_URL}/api/v1/learning-objectives`,
    data,
    {
      headers: { "X-User-Email": userEmail },
    }
  );
  return response.data;
}

export async function listLearningObjectives(
  userEmail: string,
  params?: {
    page?: number;
    limit?: number;
    domain?: string;
    level?: string;
    active?: boolean;
    search?: string;
  }
): Promise<LearningObjectiveListResponse> {
  const response = await axios.get(
    `${API_BASE_URL}/api/v1/learning-objectives`,
    {
      params,
      headers: { "X-User-Email": userEmail },
    }
  );
  return response.data;
}

export async function getLearningObjective(
  id: number,
  userEmail: string
): Promise<LearningObjectiveDto> {
  const response = await axios.get(
    `${API_BASE_URL}/api/v1/learning-objectives/${id}`,
    {
      headers: { "X-User-Email": userEmail },
    }
  );
  return response.data;
}

export async function updateLearningObjective(
  id: number,
  data: LearningObjectiveUpdateDto,
  userEmail: string
): Promise<LearningObjectiveDto> {
  const response = await axios.put(
    `${API_BASE_URL}/api/v1/learning-objectives/${id}`,
    data,
    {
      headers: { "X-User-Email": userEmail },
    }
  );
  return response.data;
}

export async function deleteLearningObjective(
  id: number,
  userEmail: string
): Promise<void> {
  await axios.delete(`${API_BASE_URL}/api/v1/learning-objectives/${id}`, {
    headers: { "X-User-Email": userEmail },
  });
}

// ============ Import ============

export async function importLearningObjectives(
  data: LearningObjectiveImportRequest,
  userEmail: string
): Promise<LearningObjectiveImportResponse> {
  const response = await axios.post(
    `${API_BASE_URL}/api/v1/learning-objectives/import`,
    data,
    {
      headers: { "X-User-Email": userEmail },
    }
  );
  return response.data;
}

// ============ Overview ============

export async function getLearningObjectivesOverview(
  userEmail: string,
  params?: {
    class_name?: string;
    course_id?: number;
    evaluation_id?: number;
    learning_objective_id?: number;
  }
): Promise<LearningObjectiveOverviewResponse> {
  const response = await axios.get(
    `${API_BASE_URL}/api/v1/learning-objectives/overview/students`,
    {
      params,
      headers: { "X-User-Email": userEmail },
    }
  );
  return response.data;
}
