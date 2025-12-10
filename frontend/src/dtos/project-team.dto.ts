/**
 * DTOs for Project Team module
 * Single source of truth: project_team and project_team_member
 */

export type ProjectTeam = {
  id: number;
  school_id: number;
  project_id: number;
  team_id: number | null;
  display_name_at_time: string;
  version: number;
  member_count: number;
  is_locked: boolean;
  created_at: string;
  backfill_source?: string | null;
};

export type ProjectTeamMember = {
  id: number;
  project_team_id: number;
  user_id: number;
  role: string | null;
  user_name: string | null;
  user_email: string | null;
  user_status?: "active" | "inactive";
  created_at: string;
};

export type ProjectTeamListResponse = {
  teams: ProjectTeam[];
  total: number;
};

export type ProjectTeamCreate = {
  team_id?: number | null;
  team_name?: string | null;
};

export type BulkAddMembersRequest = {
  members: Array<{
    user_id: number;
    role?: string | null;
  }>;
};

export type CloneProjectTeamsResponse = {
  teams_cloned: number;
  members_cloned: number;
  project_team_ids: number[];
};
