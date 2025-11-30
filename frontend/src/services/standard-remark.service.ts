// frontend/src/services/standard-remark.service.ts

import api from "@/lib/api";
import type {
  StandardRemarkDto,
  StandardRemarkCreateDto,
  StandardRemarkUpdateDto,
  StandardRemarkListResponse,
} from "@/dtos/standard-remark.dto";

export interface ListStandardRemarksParams {
  page?: number;
  per_page?: number;
  subject_id?: number;
  type?: string;
  category?: string;
}

/**
 * List standard remarks with optional filters
 */
export async function listStandardRemarks(
  params?: ListStandardRemarksParams
): Promise<StandardRemarkListResponse> {
  const response = await api.get<StandardRemarkListResponse>(
    "/templates/standard-remarks",
    { params }
  );
  return response.data;
}

/**
 * Get a single standard remark by ID
 */
export async function getStandardRemark(id: number): Promise<StandardRemarkDto> {
  const response = await api.get<StandardRemarkDto>(
    `/templates/standard-remarks/${id}`
  );
  return response.data;
}

/**
 * Create a new standard remark
 */
export async function createStandardRemark(
  data: StandardRemarkCreateDto
): Promise<StandardRemarkDto> {
  const response = await api.post<StandardRemarkDto>(
    "/templates/standard-remarks",
    data
  );
  return response.data;
}

/**
 * Update an existing standard remark
 */
export async function updateStandardRemark(
  id: number,
  data: StandardRemarkUpdateDto
): Promise<StandardRemarkDto> {
  const response = await api.patch<StandardRemarkDto>(
    `/templates/standard-remarks/${id}`,
    data
  );
  return response.data;
}

/**
 * Delete a standard remark
 */
export async function deleteStandardRemark(id: number): Promise<void> {
  await api.delete(`/templates/standard-remarks/${id}`);
}
