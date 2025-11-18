/**
 * DTOs for Project module
 */

export type Project = {
  id: number;
  school_id: number;
  course_id?: number;
  title: string;
  slug?: string;
  description?: string;
  class_name?: string;
  start_date?: string; // ISO date string
  end_date?: string; // ISO date string
  status: "concept" | "active" | "completed" | "archived";
  created_by_id: number;
  created_at: string;
  updated_at: string;
};

export type ProjectListItem = {
  id: number;
  title: string;
  course_id?: number;
  class_name?: string;
  start_date?: string;
  end_date?: string;
  status: string;
  created_at: string;
};

export type ProjectListResponse = {
  items: ProjectListItem[];
  total: number;
  page: number;
  per_page: number;
};

export type ProjectCreate = {
  title: string;
  course_id?: number;
  slug?: string;
  description?: string;
  class_name?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
};

export type ProjectUpdate = {
  title?: string;
  course_id?: number;
  slug?: string;
  description?: string;
  class_name?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
};

export type ProjectDetailOut = Project & {
  evaluation_counts: Record<string, number>;
  note_count: number;
  client_count: number;
};

export type ProjectNote = {
  id: number;
  school_id: number;
  project_id: number;
  author_id: number;
  title: string;
  body?: string;
  note_type: string;
  created_at: string;
  updated_at: string;
};

export type ProjectNoteCreate = {
  title: string;
  body?: string;
  note_type?: string;
};

export type ProjectNoteUpdate = {
  title?: string;
  body?: string;
  note_type?: string;
};

// Wizard types - NEW STRUCTURE
export type PeerEvaluationConfig = {
  enabled: boolean;
  deadline?: string; // ISO datetime string
  rubric_id?: number;
  title_suffix?: string; // e.g., "tussentijds" or "eind"
};

export type ProjectAssessmentConfig = {
  enabled: boolean;
  rubric_id: number; // Required
  deadline?: string; // ISO datetime string
  version?: string; // e.g., "tussentijds", "eind"
};

export type CompetencyScanConfig = {
  enabled: boolean;
  start_date?: string; // ISO datetime string
  end_date?: string; // ISO datetime string
  deadline?: string; // Optional separate deadline
  competency_ids?: number[];
  title?: string;
};

export type EvaluationConfig = {
  peer_tussen?: PeerEvaluationConfig;
  peer_eind?: PeerEvaluationConfig;
  project_assessment?: ProjectAssessmentConfig;
  competency_scan?: CompetencyScanConfig;
  
  // Legacy support (deprecated, for backward compatibility)
  create_peer_tussen?: boolean;
  create_peer_eind?: boolean;
  create_project_assessment?: boolean;
  create_competency_scan?: boolean;
};

export type WizardProjectCreate = {
  project: ProjectCreate;
  evaluations?: EvaluationConfig;
  client_ids?: number[];
  create_default_note?: boolean;
};

export type WizardEvaluationOut = {
  id: number;
  title: string;
  evaluation_type: string;
  status: string;
  deadline?: string;
};

export type WizardProjectAssessmentOut = {
  id: number;
  title: string;
  group_id: number;
  group_name?: string;
  rubric_id: number;
  version?: string;
  status: string;
  deadline?: string;
};

export type WizardCompetencyWindowOut = {
  id: number;
  title: string;
  start_date?: string;
  end_date?: string;
  deadline?: string;
  status: string;
  competency_ids?: number[];
};

export type WizardEntityOut = {
  type: "peer" | "project_assessment" | "competency_scan";
  data: Record<string, any>;
};

export type WizardProjectOut = {
  project: Project;
  entities: WizardEntityOut[];
  note?: ProjectNote;
  linked_clients: number[];
  warnings?: string[];
};

// Running Projects Overview Types
export type RunningProjectKPI = {
  running_projects: number;
  active_clients_now: number;
  upcoming_moments: number;
};

export type RunningProjectItem = {
  project_id: number;
  project_title: string;
  project_status: string;
  course_name?: string;
  client_id?: number;
  client_organization?: string;
  client_email?: string;
  class_name?: string;
  team_number?: number;
  student_names: string[];
  start_date?: string;
  end_date?: string;
  next_moment_type?: string;
  next_moment_date?: string;
};

export type RunningProjectsListResponse = {
  items: RunningProjectItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
};
