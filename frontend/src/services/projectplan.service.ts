import api from '@/lib/api';
import {
  ProjectPlan,
  ProjectPlanDetail,
  ProjectPlanListItem,
  ProjectPlanListResponse,
  ProjectPlanTeam,
  ProjectPlanCreate,
  ProjectPlanUpdate,
  ProjectPlanTeamUpdate,
  ProjectPlanSectionUpdate,
  ProjectPlanTeamOverviewItem,
  SectionKey,
} from '@/dtos/projectplan.dto';

export const projectPlanService = {
  // ========== Teacher Endpoints ==========

  /**
   * List all projectplans (teacher/admin)
   */
  async listProjectPlans(params?: {
    search?: string;
    course_id?: number;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ProjectPlanListResponse> {
    const { data } = await api.get('/projectplans', { params });
    return data;
  },

  /**
   * Create a new projectplan component (teacher/admin)
   */
  async createProjectPlan(payload: ProjectPlanCreate): Promise<ProjectPlanDetail> {
    const { data } = await api.post('/projectplans', payload);
    return data;
  },

  /**
   * Get projectplan detail with all teams (teacher/admin)
   */
  async getProjectPlan(id: number): Promise<ProjectPlanDetail> {
    const { data } = await api.get(`/projectplans/${id}`);
    return data;
  },

  /**
   * Get overview of all teams for a projectplan (teacher/admin)
   */
  async getProjectPlanOverview(
    id: number,
    params?: { search?: string; status?: string }
  ): Promise<ProjectPlanTeamOverviewItem[]> {
    const { data } = await api.get(`/projectplans/${id}/overview`, { params });
    return data;
  },

  /**
   * Update projectplan component metadata (teacher/admin)
   */
  async updateProjectPlan(id: number, payload: ProjectPlanUpdate): Promise<ProjectPlanDetail> {
    const { data } = await api.patch(`/projectplans/${id}`, payload);
    return data;
  },

  /**
   * Update team status and feedback (teacher/admin)
   * Use for GO/NO-GO decisions
   */
  async updateTeamStatus(
    projectPlanId: number,
    teamId: number,
    payload: ProjectPlanTeamUpdate
  ): Promise<ProjectPlanTeam> {
    const { data } = await api.patch(
      `/projectplans/${projectPlanId}/teams/${teamId}`,
      payload
    );
    return data;
  },

  /**
   * Update section feedback (teacher/admin)
   * Use for approving/rejecting sections
   */
  async updateSectionFeedback(
    projectPlanId: number,
    teamId: number,
    sectionKey: SectionKey,
    payload: ProjectPlanSectionUpdate
  ): Promise<void> {
    await api.patch(
      `/projectplans/${projectPlanId}/teams/${teamId}/sections/${sectionKey}`,
      payload
    );
  },

  /**
   * Delete projectplan component (teacher/admin)
   */
  async deleteProjectPlan(id: number): Promise<void> {
    await api.delete(`/projectplans/${id}`);
  },

  // ========== Student Endpoints ==========

  /**
   * List projectplans for current student
   */
  async listMyProjectPlans(): Promise<ProjectPlanDetail[]> {
    const { data } = await api.get('/projectplans/me/projectplans');
    return data;
  },

  /**
   * Get student's team projectplan detail
   */
  async getMyProjectPlan(id: number): Promise<ProjectPlanTeam> {
    const { data } = await api.get(`/projectplans/me/projectplans/${id}`);
    return data;
  },

  /**
   * Update student's team projectplan title
   */
  async updateMyProjectPlanTitle(
    teamId: number,
    payload: ProjectPlanTeamUpdate
  ): Promise<void> {
    await api.patch(`/projectplans/me/projectplans/${teamId}`, payload);
  },

  /**
   * Update section content (student)
   */
  async updateMySection(
    projectPlanTeamId: number,
    sectionKey: SectionKey,
    payload: ProjectPlanSectionUpdate
  ): Promise<void> {
    await api.patch(
      `/projectplans/me/projectplans/${projectPlanTeamId}/sections/${sectionKey}`,
      payload
    );
  },

  /**
   * Submit projectplan for review (student)
   */
  async submitProjectPlan(projectPlanTeamId: number): Promise<void> {
    await api.post(`/projectplans/me/projectplans/${projectPlanTeamId}/submit`);
  },
};

export default projectPlanService;
