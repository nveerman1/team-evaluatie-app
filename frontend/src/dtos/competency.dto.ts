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

export interface StudentGrowthCard {
  user_id: number;
  user_name: string;
  windows: StudentCompetencyOverview[];
  trends: Record<number, number[]>; // competency_id -> [scores over time]
}
