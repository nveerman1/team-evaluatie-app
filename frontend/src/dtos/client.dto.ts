/**
 * DTOs for Client (Opdrachtgevers) module
 */

export type Client = {
  id: number;
  school_id: number;
  organization: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  level?: string;
  sector?: string;
  tags: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientListItem = {
  id: number;
  organization: string;
  contact_name?: string;
  email?: string;
  level?: string;
  sector?: string;
  tags: string[];
  active: boolean;
  projects_this_year: number;
  last_active?: string;
  status: string;
};

export type ClientListResponse = {
  items: ClientListItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
};

export type ClientCreate = {
  organization: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  level?: string;
  sector?: string;
  tags?: string[];
  active?: boolean;
};

export type ClientUpdate = {
  organization?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  level?: string;
  sector?: string;
  tags?: string[];
  active?: boolean;
};

export type ClientLog = {
  id: number;
  client_id: number;
  author_id: number;
  log_type: string;
  text: string;
  created_at: string;
  author_name?: string;
};

export type ClientLogCreate = {
  log_type?: string;
  text: string;
};

export type ClientLogListResponse = {
  items: ClientLog[];
  total: number;
};

export type ClientProject = {
  id: number;
  title: string;
  role: string;
  start_date?: string;
  end_date?: string;
};

export type ClientProjectListResponse = {
  items: ClientProject[];
  total: number;
};

export type Reminder = {
  id: string;
  text: string;
  client_name: string;
  client_email?: string;
  due_date: string;
  template: string;
};

export type ReminderListResponse = {
  items: Reminder[];
  total: number;
};
