export type ProjectAssessmentOut = {
  id: number;
  group_id: number;
  rubric_id: number;
  teacher_id: number;
  title: string;
  version?: string | null;
  status: string; // "draft" | "published"
  published_at?: string | null;
  metadata_json: Record<string, any>;
};

export type ProjectAssessmentListItem = ProjectAssessmentOut & {
  group_name?: string | null;
  teacher_name?: string | null;
  course_name?: string | null;
  course_id?: number | null;
  scores_count: number;
  total_criteria: number;
  updated_at?: string | null;
};

export type ProjectAssessmentListResponse = {
  items: ProjectAssessmentListItem[];
  page: number;
  limit: number;
  total: number;
};

export type ProjectAssessmentCreate = {
  group_id: number;
  rubric_id: number;
  title: string;
  version?: string | null;
  metadata_json?: Record<string, any>;
};

export type ProjectAssessmentUpdate = {
  title?: string | null;
  version?: string | null;
  status?: string | null;
  metadata_json?: Record<string, any>;
};

export type ProjectAssessmentScoreOut = {
  id: number;
  assessment_id: number;
  criterion_id: number;
  score: number;
  comment?: string | null;
};

export type ProjectAssessmentScoreCreate = {
  criterion_id: number;
  score: number;
  comment?: string | null;
};

export type ProjectAssessmentScoreBatchRequest = {
  scores: ProjectAssessmentScoreCreate[];
};

export type ProjectAssessmentReflectionOut = {
  id: number;
  assessment_id: number;
  user_id: number;
  text: string;
  word_count: number;
  submitted_at?: string | null;
};

export type ProjectAssessmentReflectionCreate = {
  text: string;
};

export type ProjectAssessmentDetailOut = {
  assessment: ProjectAssessmentOut;
  scores: ProjectAssessmentScoreOut[];
  rubric_title: string;
  rubric_scale_min: number;
  rubric_scale_max: number;
  criteria: Array<{
    id: number;
    name: string;
    weight: number;
    descriptors: Record<string, string>;
  }>;
  reflection?: ProjectAssessmentReflectionOut | null;
};

export type TeamMemberInfo = {
  id: number;
  name: string;
  email: string;
};

export type TeamAssessmentStatus = {
  group_id: number;
  group_name: string;
  members: TeamMemberInfo[];
  scores_count: number;
  total_criteria: number;
  status: "not_started" | "in_progress" | "completed";
  updated_at?: string | null;
  updated_by?: string | null;
};

export type ProjectAssessmentTeamOverview = {
  assessment: ProjectAssessmentOut;
  rubric_title: string;
  rubric_scale_min: number;
  rubric_scale_max: number;
  total_criteria: number;
  teams: TeamAssessmentStatus[];
};

export type ReflectionInfo = {
  id: number;
  user_id: number;
  user_name: string;
  text: string;
  word_count: number;
  submitted_at?: string | null;
};

export type ProjectAssessmentReflectionsOverview = {
  assessment: ProjectAssessmentOut;
  group_name: string;
  reflections: ReflectionInfo[];
};
