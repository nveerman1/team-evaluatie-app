// User DTO for authentication and current user info

export type User = {
  id: number;
  email: string;
  name: string;
  role: "student" | "teacher" | "admin";
  class_name?: string; // student class name (e.g., "VWO 4A")
};
