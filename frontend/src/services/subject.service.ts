import api from "@/lib/api";
import {
  Subject,
  SubjectCreate,
  SubjectUpdate,
  SubjectListResponse,
} from "@/dtos/subject.dto";
import { Course } from "@/dtos/course.dto";

export const subjectService = {
  /**
   * Get paginated list of subjects with filtering
   */
  async listSubjects(params?: {
    page?: number;
    per_page?: number;
    is_active?: boolean;
    search?: string;
  }): Promise<SubjectListResponse> {
    const response = await api.get<SubjectListResponse>("/subjects", { params });
    return response.data;
  },

  /**
   * Get a specific subject by ID
   */
  async getSubject(subjectId: number): Promise<Subject> {
    const response = await api.get<Subject>(`/subjects/${subjectId}`);
    return response.data;
  },

  /**
   * Get all courses for a specific subject
   */
  async getSubjectCourses(
    subjectId: number,
    isActive?: boolean
  ): Promise<Course[]> {
    const response = await api.get<Course[]>(
      `/subjects/${subjectId}/courses`,
      {
        params: { is_active: isActive },
      }
    );
    return response.data;
  },

  /**
   * Create a new subject
   */
  async createSubject(data: SubjectCreate): Promise<Subject> {
    const response = await api.post<Subject>("/subjects", data);
    return response.data;
  },

  /**
   * Update a subject
   */
  async updateSubject(
    subjectId: number,
    data: SubjectUpdate
  ): Promise<Subject> {
    const response = await api.patch<Subject>(`/subjects/${subjectId}`, data);
    return response.data;
  },

  /**
   * Delete (soft delete) a subject
   */
  async deleteSubject(subjectId: number): Promise<void> {
    await api.delete(`/subjects/${subjectId}`);
  },
};
