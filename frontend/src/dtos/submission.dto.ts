export type SubmissionOut = {
  id: number;
  school_id: number;
  project_assessment_id: number;
  project_team_id: number;
  doc_type: 'report' | 'slides' | 'attachment';
  url?: string | null;
  status: 'missing' | 'submitted' | 'ok' | 'access_requested' | 'broken';
  version_label?: string | null;
  submitted_by_user_id?: number | null;
  submitted_at?: string | null;
  last_checked_by_user_id?: number | null;
  last_checked_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmissionCreate = {
  doc_type: 'report' | 'slides' | 'attachment';
  url: string;
  version_label?: string;
};

export type SubmissionUpdate = {
  url?: string | null;
};

export type SubmissionStatusUpdate = {
  status: 'missing' | 'submitted' | 'ok' | 'access_requested' | 'broken';
};

export type SubmissionWithTeamInfo = {
  submission: SubmissionOut;
  team_number?: number | null;
  team_name: string;
  members: Array<{
    id: number;
    name: string;
    email: string;
  }>;
};

export type SubmissionListResponse = {
  items: SubmissionWithTeamInfo[];
  total: number;
};

export type SubmissionEventOut = {
  id: number;
  school_id: number;
  submission_id: number;
  actor_user_id?: number | null;
  event_type: 'submitted' | 'status_changed' | 'cleared' | 'opened' | 'commented';
  payload?: Record<string, any> | null;
  created_at: string;
};

export type SubmissionEventsResponse = {
  items: SubmissionEventOut[];
  total: number;
};

export type MyTeamSubmissionsResponse = {
  team_id: number | null;
  submissions: SubmissionOut[];
};
