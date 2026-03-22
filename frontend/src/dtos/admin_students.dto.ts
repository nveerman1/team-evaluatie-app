export type AdminStudentStatus = "active" | "inactive";

export interface AdminStudent {
  id: number;
  name: string | null;
  email: string;
  class_name?: string | null;
  course_name?: string | null;
  team_number?: number | null;
  status: AdminStudentStatus;
  // Somtoday-compatibele velden
  student_number?: string | null;
  first_name?: string | null;
  prefix?: string | null;
  last_name?: string | null;
}

export interface AdminStudentCreate {
  name?: string | null;
  email: string;
  class_name?: string | null;
  team_number?: number | null;
  status?: AdminStudentStatus; // default 'active' server-side
  // Somtoday-compatibele velden
  student_number?: string | null;
  first_name?: string | null;
  prefix?: string | null;
  last_name?: string | null;
}

export interface AdminStudentUpdate {
  name?: string | null;
  email?: string;
  class_name?: string | null;
  team_number?: number | null;
  status?: AdminStudentStatus;
  // Somtoday-compatibele velden
  student_number?: string | null;
  first_name?: string | null;
  prefix?: string | null;
  last_name?: string | null;
}
