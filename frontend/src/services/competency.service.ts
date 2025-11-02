/**
 * Service for Competency Monitor API calls
 */
import api from "@/lib/api";
import type {
  Competency,
  CompetencyCreate,
  CompetencyUpdate,
  CompetencyWindow,
  CompetencyWindowCreate,
  CompetencyWindowUpdate,
  CompetencySelfScore,
  CompetencySelfScoreBulkCreate,
  CompetencyGoal,
  CompetencyGoalCreate,
  CompetencyGoalUpdate,
  CompetencyReflection,
  CompetencyReflectionCreate,
  CompetencyTeacherObservation,
  CompetencyTeacherObservationCreate,
  StudentCompetencyOverview,
  ClassHeatmap,
} from "@/dtos";

export const competencyService = {
  // ============ Competency CRUD ============

  async getCompetencies(activeOnly: boolean = true): Promise<Competency[]> {
    const response = await api.get("/competencies/", {
      params: { active_only: activeOnly },
    });
    return response.data;
  },

  async getCompetency(id: number): Promise<Competency> {
    const response = await api.get(`/competencies/${id}`);
    return response.data;
  },

  async createCompetency(data: CompetencyCreate): Promise<Competency> {
    const response = await api.post("/competencies/", data);
    return response.data;
  },

  async updateCompetency(
    id: number,
    data: CompetencyUpdate
  ): Promise<Competency> {
    const response = await api.patch(`/competencies/${id}`, data);
    return response.data;
  },

  async deleteCompetency(id: number): Promise<void> {
    await api.delete(`/competencies/${id}`);
  },

  // ============ Competency Rubric Level CRUD ============

  async getRubricLevels(competencyId: number): Promise<any[]> {
    const response = await api.get(`/competencies/${competencyId}/rubric-levels`);
    return response.data;
  },

  async createRubricLevel(competencyId: number, data: any): Promise<any> {
    const response = await api.post(
      `/competencies/${competencyId}/rubric-levels`,
      data
    );
    return response.data;
  },

  async updateRubricLevel(
    competencyId: number,
    levelId: number,
    data: any
  ): Promise<any> {
    const response = await api.patch(
      `/competencies/${competencyId}/rubric-levels/${levelId}`,
      data
    );
    return response.data;
  },

  async deleteRubricLevel(competencyId: number, levelId: number): Promise<void> {
    await api.delete(`/competencies/${competencyId}/rubric-levels/${levelId}`);
  },

  // ============ Competency Window CRUD ============

  async getWindows(statusFilter?: string, courseId?: number): Promise<CompetencyWindow[]> {
    const params: any = {};
    if (statusFilter) params.status_filter = statusFilter;
    if (courseId) params.course_id = courseId;
    const response = await api.get("/competencies/windows/", { params });
    return response.data;
  },

  async getWindow(id: number): Promise<CompetencyWindow> {
    const response = await api.get(`/competencies/windows/${id}`);
    return response.data;
  },

  async createWindow(data: CompetencyWindowCreate): Promise<CompetencyWindow> {
    const response = await api.post("/competencies/windows/", data);
    return response.data;
  },

  async updateWindow(
    id: number,
    data: CompetencyWindowUpdate
  ): Promise<CompetencyWindow> {
    const response = await api.patch(`/competencies/windows/${id}`, data);
    return response.data;
  },

  async deleteWindow(id: number): Promise<void> {
    await api.delete(`/competencies/windows/${id}`);
  },

  // ============ Self Score Endpoints ============

  async submitSelfScores(
    data: CompetencySelfScoreBulkCreate
  ): Promise<CompetencySelfScore[]> {
    const response = await api.post("/competencies/self-scores/", data);
    return response.data;
  },

  async getMySelfScores(windowId: number): Promise<CompetencySelfScore[]> {
    const response = await api.get("/competencies/self-scores/", {
      params: { window_id: windowId },
    });
    return response.data;
  },

  // ============ Goal Endpoints ============

  async createGoal(data: CompetencyGoalCreate): Promise<CompetencyGoal> {
    const response = await api.post("/competencies/goals/", data);
    return response.data;
  },

  async getMyGoals(windowId?: number): Promise<CompetencyGoal[]> {
    const response = await api.get("/competencies/goals/", {
      params: windowId ? { window_id: windowId } : {},
    });
    return response.data;
  },

  async updateGoal(id: number, data: CompetencyGoalUpdate): Promise<CompetencyGoal> {
    const response = await api.patch(`/competencies/goals/${id}`, data);
    return response.data;
  },

  // ============ Reflection Endpoints ============

  async createReflection(
    data: CompetencyReflectionCreate
  ): Promise<CompetencyReflection> {
    const response = await api.post("/competencies/reflections/", data);
    return response.data;
  },

  async getMyReflections(windowId?: number): Promise<CompetencyReflection[]> {
    const response = await api.get("/competencies/reflections/", {
      params: windowId ? { window_id: windowId } : {},
    });
    return response.data;
  },

  // ============ Teacher Observation Endpoints ============

  async createObservation(
    data: CompetencyTeacherObservationCreate
  ): Promise<CompetencyTeacherObservation> {
    const response = await api.post("/competencies/observations/", data);
    return response.data;
  },

  // ============ Overview/Aggregate Endpoints ============

  async getMyWindowOverview(
    windowId: number
  ): Promise<StudentCompetencyOverview> {
    const response = await api.get(`/competencies/windows/${windowId}/overview`);
    return response.data;
  },

  async getStudentWindowOverview(
    windowId: number,
    userId: number
  ): Promise<StudentCompetencyOverview> {
    const response = await api.get(
      `/competencies/windows/${windowId}/student/${userId}/overview`
    );
    return response.data;
  },

  async getClassHeatmap(
    windowId: number,
    className?: string
  ): Promise<ClassHeatmap> {
    const response = await api.get(`/competencies/windows/${windowId}/heatmap`, {
      params: className ? { class_name: className } : {},
    });
    return response.data;
  },
};
