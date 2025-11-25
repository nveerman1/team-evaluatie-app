/**
 * DTOs for External Project Assessments
 */

// ============ External Evaluator ============

export interface ExternalEvaluator {
  id: number;
  school_id: number;
  name: string;
  email: string;
  organisation?: string;
  created_at: string;
  updated_at: string;
}

export interface ExternalEvaluatorCreate {
  name: string;
  email: string;
  organisation?: string;
}

export interface ExternalEvaluatorUpdate {
  name?: string;
  email?: string;
  organisation?: string;
}

// ============ Token Resolution ============

export interface ExternalAssessmentTeamInfo {
  team_id: number;
  team_name: string;
  team_number?: number;
  members?: string;
  project_id?: number;
  project_title?: string;
  class_name?: string;
  description?: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';
}

export interface ExternalAssessmentTokenInfo {
  token: string;
  external_evaluator: ExternalEvaluator;
  teams: ExternalAssessmentTeamInfo[];
  project_name?: string;
  class_name?: string;
  single_team: boolean;
}

// ============ Assessment Detail ============

export interface RubricCriterionForExternal {
  id: number;
  name: string;
  weight: number;
  descriptors: Record<string, string>;
  category?: string;
}

export interface RubricForExternal {
  id: number;
  title: string;
  description?: string;
  scale_min: number;
  scale_max: number;
  criteria: RubricCriterionForExternal[];
}

export interface ExternalAssessmentScoreOut {
  criterion_id: number;
  score: number;
  comment?: string;
}

export interface ExternalAssessmentDetail {
  team_id: number;
  team_name: string;
  team_number?: number;
  members?: string;
  project_title?: string;
  project_description?: string;
  rubric: RubricForExternal;
  existing_scores: ExternalAssessmentScoreOut[];
  general_comment?: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';
}

// ============ Submission ============

export interface ExternalAssessmentScoreSubmit {
  criterion_id: number;
  score: number;
  comment?: string;
}

export interface ExternalAssessmentSubmit {
  scores: ExternalAssessmentScoreSubmit[];
  general_comment?: string;
  submit: boolean;
}

export interface ExternalAssessmentSubmitResponse {
  success: boolean;
  message: string;
  status: 'IN_PROGRESS' | 'SUBMITTED';
}

// ============ Teacher Management ============

export interface ProjectTeamExternal {
  id: number;
  school_id: number;
  group_id: number;
  team_number?: number;
  external_evaluator_id: number;
  project_id?: number;
  invitation_token: string;
  token_expires_at?: string;
  status: 'NOT_INVITED' | 'INVITED' | 'IN_PROGRESS' | 'SUBMITTED';
  created_at: string;
  updated_at: string;
  invited_at?: string;
  submitted_at?: string;
}

export interface TeamIdentifier {
  group_id: number;
  team_number: number;
}

export interface ExternalAssessmentPerTeamConfig {
  group_id: number;
  team_number: number;
  evaluator_name: string;
  evaluator_email: string;
  evaluator_organisation?: string;
}

export interface ExternalAssessmentAllTeamsConfig {
  evaluator_name: string;
  evaluator_email: string;
  evaluator_organisation?: string;
  teams: TeamIdentifier[];
  rubric_id?: number;
}

export interface BulkInviteRequest {
  mode: 'PER_TEAM' | 'ALL_TEAMS';
  per_team_configs?: ExternalAssessmentPerTeamConfig[];
  all_teams_config?: ExternalAssessmentAllTeamsConfig;
}

export interface ExternalAssessmentStatus {
  team_id: number;
  team_number: number;
  team_name: string;
  members?: string;
  external_evaluator?: ExternalEvaluator;
  status: string;
  invitation_sent: boolean;
  submitted_at?: string;
  updated_at?: string;
}

// ============ External Advisory Detail (Teacher View) ============

export interface ExternalAdvisoryScoreOut {
  criterion_id: number;
  criterion_name: string;
  category?: string;
  score: number;
  comment?: string;
}

export interface ExternalAdvisoryDetail {
  team_id: number;
  team_name: string;
  external_evaluator: ExternalEvaluator;
  rubric_title: string;
  rubric_scale_min: number;
  rubric_scale_max: number;
  scores: ExternalAdvisoryScoreOut[];
  general_comment?: string;
  submitted_at?: string;
  status: string;
}
