import api from "@/lib/api";
import {
  CourseLite,
  Course,
  CourseCreate,
  CourseUpdate,
  CourseListResponse,
  TeacherCourse,
  TeacherCourseCreate,
  CourseStudent,
  StudentTeamUpdate,
} from "@/dtos/course.dto";

export const courseService = {
  /**
   * Get list of courses/clusters (legacy endpoint for students)
   */
  async getCourses(): Promise<CourseLite[]> {
    const response = await api.get<CourseLite[]>("/students/courses");
    return Array.isArray(response.data) ? response.data : [];
  },

  /**
   * Get paginated list of courses with filtering
   */
  async listCourses(params?: {
    page?: number;
    per_page?: number;
    level?: string;
    year?: number;
    is_active?: boolean;
    search?: string;
  }): Promise<CourseListResponse> {
    const response = await api.get<CourseListResponse>("/courses", { params });
    return response.data;
  },

  /**
   * Get a specific course by ID
   */
  async getCourse(courseId: number): Promise<Course> {
    const response = await api.get<Course>(`/courses/${courseId}`);
    return response.data;
  },

  /**
   * Create a new course
   */
  async createCourse(data: CourseCreate): Promise<Course> {
    const response = await api.post<Course>("/courses", data);
    return response.data;
  },

  /**
   * Update a course
   */
  async updateCourse(courseId: number, data: CourseUpdate): Promise<Course> {
    const response = await api.patch<Course>(`/courses/${courseId}`, data);
    return response.data;
  },

  /**
   * Delete (soft delete) a course
   */
  async deleteCourse(courseId: number): Promise<void> {
    await api.delete(`/courses/${courseId}`);
  },

  /**
   * Get teachers assigned to a course
   */
  async getCourseTeachers(courseId: number): Promise<TeacherCourse[]> {
    const response = await api.get<TeacherCourse[]>(
      `/courses/${courseId}/teachers`
    );
    return response.data;
  },

  /**
   * Assign a teacher to a course
   */
  async assignTeacher(
    courseId: number,
    data: TeacherCourseCreate
  ): Promise<TeacherCourse> {
    const response = await api.post<TeacherCourse>(
      `/courses/${courseId}/teachers`,
      data
    );
    return response.data;
  },

  /**
   * Remove a teacher from a course
   */
  async removeTeacher(courseId: number, teacherId: number): Promise<void> {
    await api.delete(`/courses/${courseId}/teachers/${teacherId}`);
  },

  /**
   * Get students enrolled in a course
   */
  async getCourseStudents(courseId: number): Promise<CourseStudent[]> {
    const response = await api.get<CourseStudent[]>(
      `/courses/${courseId}/students`
    );
    return response.data;
  },

  /**
   * Add a student to a course
   */
  async addStudentToCourse(
    courseId: number,
    student: {
      name: string;
      email: string;
      class_name?: string;
      team_number?: number | null;
    }
  ): Promise<CourseStudent> {
    const response = await api.post<CourseStudent>(
      `/courses/${courseId}/students`,
      student
    );
    return response.data;
  },

  /**
   * Bulk update student team assignments
   */
  async bulkUpdateStudentTeams(
    courseId: number,
    updates: StudentTeamUpdate[]
  ): Promise<void> {
    await api.patch(`/courses/${courseId}/students/bulk-update`, { updates });
  },
};
