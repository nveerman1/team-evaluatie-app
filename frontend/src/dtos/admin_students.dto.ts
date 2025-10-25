export type AdminStudentStatus = "active" | "inactive";

export interface AdminStudent {
  id: number;
  name: string | null;
  email: string;
  class_name?: string | null;
  cluster?: string | null;
  team_number?: number | null;
  status: AdminStudentStatus;
}

export interface AdminStudentCreate {
  name: string;
  email: string;
  class_name?: string | null;
  cluster?: string | null;
  team_number?: number | null;
  status?: AdminStudentStatus; // default 'active' server-side
}

export interface AdminStudentUpdate {
  name?: string | null;
  email?: string;
  class_name?: string | null;
  cluster?: string | null;
  team_number?: number | null;
  status?: AdminStudentStatus;
}
