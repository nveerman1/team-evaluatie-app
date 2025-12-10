import api from "@/lib/api";
import {
  ProjectTeam,
  ProjectTeamMember,
  ProjectStudent,
  ProjectTeamListResponse,
  ProjectTeamCreate,
  BulkAddMembersRequest,
  CloneProjectTeamsResponse,
} from "@/dtos/project-team.dto";

export const projectTeamService = {
  /**
   * Get all project teams for a project
   */
  async listProjectTeams(
    projectId: number,
    signal?: AbortSignal
  ): Promise<ProjectTeamListResponse> {
    const response = await api.get<ProjectTeamListResponse>(
      `/project-teams/projects/${projectId}/teams`,
      { signal }
    );
    return response.data;
  },

  /**
   * Get all students for a project with project-specific team information
   */
  async getProjectStudents(
    projectId: number,
    signal?: AbortSignal
  ): Promise<ProjectStudent[]> {
    const response = await api.get<ProjectStudent[]>(
      `/project-teams/projects/${projectId}/students`,
      { signal }
    );
    return response.data;
  },

  /**
   * Get members of a specific project team
   */
  async getProjectTeamMembers(
    projectTeamId: number,
    signal?: AbortSignal
  ): Promise<ProjectTeamMember[]> {
    const response = await api.get<ProjectTeamMember[]>(
      `/project-teams/${projectTeamId}/members`,
      { signal }
    );
    return response.data;
  },

  /**
   * Create a new project team
   */
  async createProjectTeam(
    projectId: number,
    data: ProjectTeamCreate
  ): Promise<ProjectTeam> {
    const response = await api.post<ProjectTeam>(
      `/project-teams/projects/${projectId}/teams`,
      data
    );
    return response.data;
  },

  /**
   * Clone teams from another project
   */
  async cloneProjectTeams(
    targetProjectId: number,
    sourceProjectId: number
  ): Promise<CloneProjectTeamsResponse> {
    const response = await api.post<CloneProjectTeamsResponse>(
      `/project-teams/projects/${targetProjectId}/teams/clone-from/${sourceProjectId}`
    );
    return response.data;
  },

  /**
   * Add members to a project team (only allowed when unlocked)
   */
  async addProjectTeamMembers(
    projectTeamId: number,
    data: BulkAddMembersRequest
  ): Promise<ProjectTeamMember[]> {
    const response = await api.post<ProjectTeamMember[]>(
      `/project-teams/${projectTeamId}/members`,
      data
    );
    return response.data;
  },

  /**
   * Update team assignments for students in a project
   */
  async updateProjectStudentTeams(
    projectId: number,
    updates: Array<{ student_id: number; team_number: number | null }>
  ): Promise<{ status: string; updated: number }> {
    const response = await api.patch<{ status: string; updated: number }>(
      `/project-teams/projects/${projectId}/student-teams`,
      updates
    );
    return response.data;
  },
};
