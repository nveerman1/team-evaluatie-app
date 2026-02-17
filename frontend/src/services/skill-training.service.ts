/**
 * Service for Skill Trainings API calls
 */
import api from "@/lib/api";
import type {
  SkillTraining,
  SkillTrainingCreate,
  SkillTrainingUpdate,
  TeacherProgressMatrixResponse,
  SkillTrainingProgress,
  BulkProgressUpdate,
  StudentTrainingListResponse,
  StudentStatusUpdate,
  SkillTrainingStatus,
} from "@/dtos";

export const skillTrainingService = {
  // ============ Teacher CRUD ============

  async listTrainings(isActive?: boolean): Promise<SkillTraining[]> {
    const params = new URLSearchParams();
    if (isActive !== undefined) {
      params.append("is_active", String(isActive));
    }
    const response = await api.get(`/skill-trainings?${params.toString()}`);
    return response.data;
  },

  async createTraining(data: SkillTrainingCreate): Promise<SkillTraining> {
    const response = await api.post("/skill-trainings", data);
    return response.data;
  },

  async updateTraining(
    id: number,
    data: SkillTrainingUpdate
  ): Promise<SkillTraining> {
    const response = await api.patch(`/skill-trainings/${id}`, data);
    return response.data;
  },

  // ============ Teacher Progress ============

  async getProgressMatrix(
    courseId: number,
    className?: string
  ): Promise<TeacherProgressMatrixResponse> {
    const params = new URLSearchParams();
    params.append("course_id", String(courseId));
    if (className) {
      params.append("class_name", className);
    }
    const response = await api.get(`/skill-trainings/progress?${params.toString()}`);
    return response.data;
  },

  async updateProgressSingle(
    studentId: number,
    trainingId: number,
    courseId: number,
    status: SkillTrainingStatus,
    note?: string
  ): Promise<SkillTrainingProgress> {
    const params = new URLSearchParams();
    params.append("course_id", String(courseId));
    params.append("status", status);
    if (note) {
      params.append("note", note);
    }
    const response = await api.patch(
      `/skill-trainings/progress/${studentId}/${trainingId}?${params.toString()}`
    );
    return response.data;
  },

  async bulkUpdateProgress(
    courseId: number,
    data: BulkProgressUpdate
  ): Promise<void> {
    const params = new URLSearchParams();
    params.append("course_id", String(courseId));
    await api.post(`/skill-trainings/progress/bulk?${params.toString()}`, data);
  },

  // ============ Student ============

  async getMyTrainings(): Promise<StudentTrainingListResponse> {
    const response = await api.get("/skill-trainings/me/skill-trainings");
    return response.data;
  },

  async updateMyStatus(
    trainingId: number,
    data: StudentStatusUpdate
  ): Promise<SkillTrainingProgress> {
    const response = await api.patch(
      `/skill-trainings/me/skill-trainings/${trainingId}`,
      data
    );
    return response.data;
  },
};
