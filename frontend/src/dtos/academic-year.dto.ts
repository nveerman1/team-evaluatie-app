/**
 * Academic Year DTOs
 */

export interface AcademicYear {
  id: number;
  school_id: number;
  label: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export interface AcademicYearListResponse {
  academic_years: AcademicYear[];
  total: number;
  page: number;
  per_page: number;
}

export interface ClassMapping {
  [sourceClassName: string]: string; // target class name
}

export interface TransitionRequest {
  target_academic_year_id: number;
  class_mapping: ClassMapping;
  copy_course_enrollments: boolean;
}

export interface TransitionResult {
  classes_created: number;
  students_moved: number;
  courses_created: number;
  enrollments_copied: number;
  skipped_students: number;
}

export interface ClassInfo {
  id: number;
  school_id: number;
  academic_year_id: number;
  name: string;
  academic_year_label?: string;
  created_at: string;
  updated_at: string;
  student_count?: number;
}

export interface ClassListResponse {
  classes: ClassInfo[];
  total: number;
  page: number;
  per_page: number;
}
