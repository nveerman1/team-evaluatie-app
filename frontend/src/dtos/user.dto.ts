// User DTO for authentication and current user info

export type User = {
  id: number;
  school_id: number;
  email: string;
  name: string;
  role: "student" | "teacher" | "admin";
  class_name?: string; // student class name (e.g., "VWO 4A")
};

export type School = {
  id: number;
  name: string;
};

export type UserWithSchools = User & {
  schools?: School[]; // For users who have access to multiple schools
};
