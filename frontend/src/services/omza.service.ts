// frontend/src/services/omza.service.ts

import api from "@/lib/api";
import {
  OmzaDataResponse,
  TeacherScoreCreate,
  TeacherCommentCreate,
  StandardComment,
  StandardCommentCreate,
} from "@/dtos/omza.dto";

export const omzaService = {
  /**
   * Get OMZA data for an evaluation
   */
  async getOmzaData(evaluationId: number): Promise<OmzaDataResponse> {
    const response = await api.get<OmzaDataResponse>(
      `/omza/evaluations/${evaluationId}/data`
    );
    return response.data;
  },

  /**
   * Save teacher score for a student and category
   */
  async saveTeacherScore(
    evaluationId: number,
    data: TeacherScoreCreate
  ): Promise<{ message: string; student_id: number; category: string }> {
    const response = await api.post(
      `/omza/evaluations/${evaluationId}/teacher-score`,
      data
    );
    return response.data;
  },

  /**
   * Save teacher comment for a student
   */
  async saveTeacherComment(
    evaluationId: number,
    data: TeacherCommentCreate
  ): Promise<{ message: string; student_id: number }> {
    const response = await api.post(
      `/omza/evaluations/${evaluationId}/teacher-comment`,
      data
    );
    return response.data;
  },

  /**
   * Get standard comments for an evaluation, optionally filtered by category
   */
  async getStandardComments(
    evaluationId: number,
    category?: string
  ): Promise<StandardComment[]> {
    const response = await api.get<StandardComment[]>(
      `/omza/evaluations/${evaluationId}/standard-comments`,
      {
        params: category ? { category } : undefined,
      }
    );
    return response.data;
  },

  /**
   * Add a new standard comment for an evaluation
   */
  async addStandardComment(
    evaluationId: number,
    data: StandardCommentCreate
  ): Promise<StandardComment> {
    const response = await api.post<StandardComment>(
      `/omza/evaluations/${evaluationId}/standard-comments`,
      data
    );
    return response.data;
  },

  /**
   * Delete a standard comment
   */
  async deleteStandardComment(
    evaluationId: number,
    commentId: string
  ): Promise<{ message: string }> {
    const response = await api.delete(
      `/omza/evaluations/${evaluationId}/standard-comments/${commentId}`
    );
    return response.data;
  },
};
