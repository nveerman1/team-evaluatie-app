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
  RunningProjectKPI,
  RunningProjectsListResponse,
  Subproject,
  SubprojectCreate,
  SubprojectUpdate,
  SubprojectListResponse,
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

  /**
   * Get KPI statistics for running projects overview
   */
  async getRunningProjectsKPI(): Promise<RunningProjectKPI> {
    const response = await api.get<RunningProjectKPI>("/projects/running-overview/kpi");
    return response.data;
  },

  /**
   * Get running projects overview with filtering and sorting
   */
  async getRunningProjectsOverview(params?: {
    page?: number;
    per_page?: number;
    course_id?: number;
    school_year?: string;
    status?: string;
    search?: string;
    sort_by?: string;
    sort_order?: "asc" | "desc";
  }): Promise<RunningProjectsListResponse> {
    const response = await api.get<RunningProjectsListResponse>("/projects/running-overview", { params });
    return response.data;
  },

  // ============ Subproject Methods ============

  /**
   * Get all subprojects for a project
   */
  async listSubprojects(projectId: number): Promise<SubprojectListResponse> {
    const response = await api.get<SubprojectListResponse>(`/projects/${projectId}/subprojects`);
    return response.data;
  },

  /**
   * Get a specific subproject
   */
  async getSubproject(projectId: number, subprojectId: number): Promise<Subproject> {
    const response = await api.get<Subproject>(`/projects/${projectId}/subprojects/${subprojectId}`);
    return response.data;
  },

  /**
   * Create a new subproject for a project
   */
  async createSubproject(projectId: number, data: SubprojectCreate): Promise<Subproject> {
    const response = await api.post<Subproject>(`/projects/${projectId}/subprojects`, data);
    return response.data;
  },

  /**
   * Update a subproject
   */
  async updateSubproject(projectId: number, subprojectId: number, data: SubprojectUpdate): Promise<Subproject> {
    const response = await api.patch<Subproject>(`/projects/${projectId}/subprojects/${subprojectId}`, data);
    return response.data;
  },

  /**
   * Delete a subproject
   */
  async deleteSubproject(projectId: number, subprojectId: number): Promise<void> {
    await api.delete(`/projects/${projectId}/subprojects/${subprojectId}`);
  },
};
