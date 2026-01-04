/**
 * DTOs for Task module (Opdrachtgeverstaken)
 */

export type TaskStatus = "open" | "done" | "dismissed";
export type TaskType = "opdrachtgever" | "docent" | "project";
export type TaskSource = "tussenpresentatie" | "eindpresentatie" | "manual";

export type Task = {
  id: number;
  school_id: number;
  title: string;
  description?: string;
  due_date?: string; // ISO date string
  status: TaskStatus;
  type: TaskType;
  project_id?: number;
  client_id?: number;
  class_id?: number;
  auto_generated: boolean;
  source: TaskSource;
  email_to?: string;
  email_cc?: string;
  completed_at?: string; // ISO datetime string
  created_at: string;
  updated_at: string;
  
  // Enriched context from joins
  project_name?: string;
  class_name?: string;
  client_name?: string;
  client_email?: string;
  course_name?: string;
};

export type TaskListResponse = {
  items: Task[];
  total: number;
  page: number;
  per_page: number;
};

export type TaskCreate = {
  title: string;
  description?: string;
  due_date?: string; // ISO date string
  status?: TaskStatus;
  type?: TaskType;
  project_id?: number;
  client_id?: number;
  class_id?: number;
  email_to?: string;
  email_cc?: string;
};

export type TaskUpdate = {
  title?: string;
  description?: string;
  due_date?: string; // ISO date string
  status?: TaskStatus;
  type?: TaskType;
  project_id?: number;
  client_id?: number;
  class_id?: number;
  email_to?: string;
  email_cc?: string;
};

export type TaskFilters = {
  status?: TaskStatus;
  type?: TaskType;
  from?: string; // ISO date string
  to?: string; // ISO date string
  project_id?: number;
  client_id?: number;
  page?: number;
  per_page?: number;
};
