export type Group = {
  id: number;
  school_id: number;
  course_id: number;
  name: string;
  team_number?: number;
  created_at: string;
  updated_at: string;
};

export type GroupCreate = {
  course_id: number;
  name: string;
  team_number?: number;
};

export type GroupUpdate = {
  name?: string;
  team_number?: number;
};

export type GroupMember = {
  id: number;
  group_id: number;
  user_id: number;
  active: boolean;
  user_name?: string;
  user_email?: string;
  user_class_name?: string;
};

export type GroupMemberCreate = {
  user_id: number;
};

export type GroupWithMembers = Group & {
  members: GroupMember[];
  member_count: number;
};

export type GroupListResponse = {
  groups: GroupWithMembers[];
  total: number;
  page: number;
  per_page: number;
};
