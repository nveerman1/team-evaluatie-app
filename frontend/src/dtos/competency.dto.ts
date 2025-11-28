/**
 * DTOs for Competency Monitor
 */

export interface Competency {
  id: number;
  school_id: number;
  name: string;
  description?: string;
  category?: string;
  order: number;
  active: boolean;
  scale_min: number;
  scale_max: number;
  scale_labels: Record<string, string>;
  metadata_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CompetencyCreate {
  name: string;
  description?: string;
  category?: string;
  order?: number;
  active?: boolean;
  scale_min?: number;
  scale_max?: number;
  scale_labels?: Record<string, string>;
  metadata_json?: Record<string, any>;
}

export interface CompetencyUpdate {
  name?: string;
  description?: string;
  category?: string;
  order?: number;
  active?: boolean;
  scale_min?: number;
  scale_max?: number;
  scale_labels?: Record<string, string>;
  metadata_json?: Record<string, any>;
}

export interface CompetencyWindow {
  id: number;
  school_id: number;
  title: string;
  description?: string;
  class_names: string[];
  course_id?: number;
  start_date?: string;
  end_date?: string;
  status: "draft" | "open" | "closed";
  require_self_score: boolean;
  require_goal: boolean;
  require_reflection: boolean;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CompetencyWindowSettings {
  allow_external_feedback?: boolean;
  max_invites_per_subject?: number;
  invite_ttl_days?: number;
  show_subject_name_to_external?: "full" | "partial" | "none";
  show_external_names_to_teacher?: boolean;
  external_instructions?: string;
  external_weight?: number; // weighting for external scores (default 1.0)
}

export interface CompetencyWindowCreate {
  title: string;
  description?: string;
  class_names?: string[];
  course_id?: number;
  start_date?: string;
  end_date?: string;
  status?: string;
  require_self_score?: boolean;
  require_goal?: boolean;
  require_reflection?: boolean;
  settings?: Record<string, any>;
}

export interface CompetencyWindowUpdate {
  title?: string;
  description?: string;
  class_names?: string[];
  course_id?: number;
  start_date?: string;
  end_date?: string;
  status?: string;
  require_self_score?: boolean;
  require_goal?: boolean;
  require_reflection?: boolean;
  settings?: Record<string, any>;
}

export interface CompetencySelfScore {
  id: number;
  school_id: number;
  window_id: number;
  user_id: number;
  competency_id: number;
  score: number;
  example?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CompetencySelfScoreInput {
  competency_id: number;
  score: number;
  example?: string;
}

export interface CompetencySelfScoreBulkCreate {
  window_id: number;
  scores: CompetencySelfScoreInput[];
}

export interface CompetencyGoal {
  id: number;
  school_id: number;
  window_id: number;
  user_id: number;
  competency_id?: number;
  goal_text: string;
  success_criteria?: string;
  status: "in_progress" | "achieved" | "not_achieved";
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CompetencyGoalCreate {
  window_id: number;
  goal_text: string;
  success_criteria?: string;
  competency_id?: number;
  status?: string;
}

export interface CompetencyGoalUpdate {
  goal_text?: string;
  success_criteria?: string;
  competency_id?: number;
  status?: string;
}

export interface CompetencyReflection {
  id: number;
  school_id: number;
  window_id: number;
  user_id: number;
  goal_id?: number;
  text: string;
  goal_achieved?: boolean;
  evidence?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CompetencyReflectionCreate {
  window_id: number;
  text: string;
  goal_id?: number;
  goal_achieved?: boolean;
  evidence?: string;
}

export interface CompetencyTeacherObservation {
  id: number;
  school_id: number;
  window_id: number;
  user_id: number;
  competency_id: number;
  teacher_id: number;
  score: number;
  comment?: string;
  created_at: string;
  updated_at: string;
}

export interface CompetencyTeacherObservationCreate {
  window_id: number;
  user_id: number;
  competency_id: number;
  score: number;
  comment?: string;
}

export interface CompetencyScore {
  competency_id: number;
  competency_name: string;
  self_score?: number;
  peer_score?: number;
  teacher_score?: number;
  external_score?: number;
  external_count: number;
  final_score?: number;
  delta?: number;
}

export interface StudentCompetencyOverview {
  window_id: number;
  user_id: number;
  user_name: string;
  scores: CompetencyScore[];
  goals: CompetencyGoal[];
  reflection?: CompetencyReflection;
}

export interface ClassHeatmapRow {
  user_id: number;
  user_name: string;
  scores: Record<number, number>; // competency_id -> final_score
  deltas: Record<number, number>; // competency_id -> delta
}

export interface ClassHeatmap {
  window_id: number;
  window_title: string;
  competencies: Competency[];
  rows: ClassHeatmapRow[];
}

// ============ Teacher View DTOs ============

export interface TeacherGoalItem {
  id: number;
  user_id: number;
  user_name: string;
  class_name?: string;
  goal_text: string;
  success_criteria?: string;
  competency_id?: number;
  competency_name?: string;
  status: string;
  submitted_at?: string;
  updated_at: string;
}

export interface TeacherGoalsList {
  window_id: number;
  window_title: string;
  items: TeacherGoalItem[];
}

export interface TeacherReflectionItem {
  id: number;
  user_id: number;
  user_name: string;
  class_name?: string;
  text: string;
  goal_id?: number;
  goal_text?: string;
  goal_achieved?: boolean;
  evidence?: string;
  submitted_at?: string;
  updated_at: string;
}

export interface TeacherReflectionsList {
  window_id: number;
  window_title: string;
  items: TeacherReflectionItem[];
}

export interface StudentGrowthCard {
  user_id: number;
  user_name: string;
  windows: StudentCompetencyOverview[];
  trends: Record<number, number[]>; // competency_id -> [scores over time]
}

export interface CompetencyRubricLevel {
  id: number;
  school_id: number;
  competency_id: number;
  level: number;
  label?: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface CompetencyRubricLevelCreate {
  competency_id: number;
  level: number;
  label?: string;
  description: string;
}

export interface CompetencyRubricLevelUpdate {
  label?: string;
  description?: string;
}

// ============ External Invite DTOs ============

export interface ExternalInviteCreate {
  window_id: number;
  subject_user_id: number;
  emails: string[];
  external_name?: string;
  external_organization?: string;
  competency_ids?: number[]; // Optional: if empty or undefined, all competencies are included
}

export interface ExternalInvite {
  id: number;
  school_id: number;
  window_id: number;
  subject_user_id: number;
  invited_by_user_id: number;
  email: string;
  external_name?: string;
  external_organization?: string;
  status: string; // pending|used|revoked|expired
  created_at: string;
  expires_at: string;
  sent_at?: string;
  opened_at?: string;
  submitted_at?: string;
  revoked_at?: string;
}

export interface ExternalInvitePublicInfo {
  window_title: string;
  subject_name: string;
  competencies: Competency[];
  scale_min: number;
  scale_max: number;
  instructions?: string;
}

export interface ExternalScoreSubmit {
  token: string;
  scores: Array<{
    competency_id: number;
    score: number;
    comment?: string;
  }>;
  reviewer_name?: string;
  reviewer_organization?: string;
  general_comment?: string;
}
