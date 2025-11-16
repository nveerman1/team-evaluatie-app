import api from "@/lib/api";
import {
  Project,
  ProjectListItem,
  ProjectListResponse,
  ProjectCreate,
  ProjectUpdate,
  ProjectDetailOut,
  WizardProjectCreate,
  WizardProjectOut,
} from "@/dtos/project.dto";

export const projectService = {
  /**
   * Get paginated list of projects with filtering
   */
  async listProjects(params?: {
    page?: number;
    per_page?: number;
    course_id?: number;
    status?: string;
    search?: string;
  }): Promise<ProjectListResponse> {
    const response = await api.get<ProjectListResponse>("/projects", { params });
    return response.data;
  },

  /**
   * Get a specific project by ID
   */
  async getProject(projectId: number): Promise<ProjectDetailOut> {
    const response = await api.get<ProjectDetailOut>(`/projects/${projectId}`);
    return response.data;
  },

  /**
   * Create a new project
   */
  async createProject(data: ProjectCreate): Promise<Project> {
    const response = await api.post<Project>("/projects", data);
    return response.data;
  },

  /**
   * Update a project
   */
  async updateProject(projectId: number, data: ProjectUpdate): Promise<Project> {
    const response = await api.patch<Project>(`/projects/${projectId}`, data);
    return response.data;
  },

  /**
   * Delete (archive) a project
   */
  async deleteProject(projectId: number): Promise<void> {
    await api.delete(`/projects/${projectId}`);
  },

  /**
   * Get notes for a project
   */
  async getProjectNotes(projectId: number): Promise<any[]> {
    const response = await api.get<any[]>(`/projects/${projectId}/notes`);
    return response.data;
  },

  /**
   * Create a project via the wizard with linked evaluations, notes, and clients
   */
  async wizardCreateProject(data: WizardProjectCreate): Promise<WizardProjectOut> {
    const response = await api.post<WizardProjectOut>("/projects/wizard-create", data);
    return response.data;
  },
};
