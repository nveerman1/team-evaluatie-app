// DTOs for ProjectPlan (GO/NO-GO) feature

export enum ProjectPlanStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PUBLISHED = 'published',
  CLOSED = 'closed',
}

export enum PlanStatus {
  CONCEPT = 'concept',
  INGEDIEND = 'ingediend',
  GO = 'go',
  NO_GO = 'no-go',
}

export enum SectionKey {
  CLIENT = 'client',
  PROBLEM = 'problem',
  GOAL = 'goal',
  METHOD = 'method',
  PLANNING = 'planning',
  TASKS = 'tasks',
  MOTIVATION = 'motivation',
  RISKS = 'risks',
}

export enum SectionStatus {
  EMPTY = 'empty',
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REVISION = 'revision',
}

export interface ClientData {
  organisation?: string;
  contact?: string;
  email?: string;
  phone?: string;
  description?: string;
}

export interface ProjectPlanSection {
  id: number;
  key: SectionKey;
  status: SectionStatus;
  text?: string;
  client?: ClientData;
  teacher_note?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectPlanTeam {
  id: number;
  project_team_id: number;
  team_number?: number;
  team_members: string[];
  title?: string;
  status: PlanStatus;
  locked: boolean;
  sections: ProjectPlanSection[];
  global_teacher_note?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectPlan {
  id: number;
  project_id: number;
  school_id: number;
  title?: string;
  version?: string;
  status: ProjectPlanStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectPlanDetail extends ProjectPlan {
  project_name: string;
  course_id?: number;
  course_name?: string;
  team_count: number;
  teams: ProjectPlanTeam[];
}

export interface ProjectPlanListItem {
  id: number;
  title?: string;
  version?: string;
  status: ProjectPlanStatus;
  project_id: number;
  project_name: string;
  course_id?: number;
  course_name?: string;
  team_count: number;
  teams_summary: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface ProjectPlanListResponse {
  items: ProjectPlanListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface ProjectPlanCreate {
  project_id: number;
  title?: string;
  version?: string;
  status?: ProjectPlanStatus;
}

export interface ProjectPlanUpdate {
  title?: string;
  version?: string;
  status?: ProjectPlanStatus;
}

export interface ProjectPlanTeamUpdate {
  title?: string;
  status?: PlanStatus;
  locked?: boolean;
  global_teacher_note?: string;
}

export interface ProjectPlanSectionUpdate {
  text?: string;
  client?: ClientData;
  status?: SectionStatus;
  teacher_note?: string;
}

export interface ProjectPlanTeamOverviewItem {
  id: number;
  project_team_id: number;
  team_number?: number;
  team_name: string;
  team_members: string[];
  title?: string;
  status: PlanStatus;
  locked: boolean;
  sections_filled: number;
  sections_total: number;
  last_updated: string;
  global_teacher_note?: string;
}
