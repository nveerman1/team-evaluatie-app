export type CourseLite = {
  id: number;
  name: string;
};

export type Course = {
  id: number;
  school_id: number;
  subject_id?: number;
  name: string;
  code?: string;
  period?: string;
  level?: string;
  year?: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  teacher_names?: string[];
  academic_year_label?: string;
};

export type CourseCreate = {
  name: string;
  code?: string;
  period?: string;
  level?: string;
  year?: number;
  description?: string;
  subject_id?: number;
};

export type CourseUpdate = {
  name?: string;
  code?: string;
  period?: string;
  level?: string;
  year?: number;
  description?: string;
  subject_id?: number | null;
  is_active?: boolean;
};

export type CourseListResponse = {
  courses: Course[];
  total: number;
  page: number;
  per_page: number;
};

export type TeacherCourse = {
  id: number;
  teacher_id: number;
  course_id: number;
  role: "teacher" | "coordinator";
  is_active: boolean;
  teacher_name?: string;
  teacher_email?: string;
};

export type TeacherCourseCreate = {
  teacher_id: number;
  role?: "teacher" | "coordinator";
};

export type BulkTeacherAssignment = {
  teacher_ids: number[];
  role?: "teacher" | "coordinator";
};

export type CourseStudent = {
  id: number;
  name: string;
  email: string;
  class_name?: string;
  team_number?: number;
  status?: "active" | "inactive";
};

export type StudentTeamUpdate = {
  student_id: number;
  team_number?: number;
};
