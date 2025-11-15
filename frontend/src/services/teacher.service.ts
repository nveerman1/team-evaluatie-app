import api from "@/lib/api";

// Types matching backend schemas
export type CourseInfo = {
  id: number;
  name: string;
  code?: string;
  level?: string;
  year?: number;
};

export type Teacher = {
  id: number;
  school_id: number;
  name: string;
  email: string;
  role: "teacher" | "admin";
  archived: boolean;
  courses: CourseInfo[];
  created_at?: string;
  last_login?: string;
};

export type TeacherListResponse = {
  teachers: Teacher[];
  total: number;
  page: number;
  per_page: number;
};

export type TeacherCreate = {
  name: string;
  email: string;
  role: "teacher" | "admin";
  password?: string;
};

export type TeacherUpdate = {
  name?: string;
  email?: string;
  role?: "teacher" | "admin";
  archived?: boolean;
};

export type TeacherCourseAssignment = {
  course_id: number;
  role?: "teacher" | "coordinator";
};

export type CSVImportResult = {
  success_count: number;
  error_count: number;
  errors: string[];
  created: number[];
  updated: number[];
};

export const teacherService = {
  /**
   * List teachers with pagination and filters
   */
  async listTeachers(params: {
    page?: number;
    per_page?: number;
    search?: string;
    role?: "teacher" | "admin";
    status?: "active" | "inactive";
    sort?: "name" | "email" | "role";
    direction?: "asc" | "desc";
  }): Promise<TeacherListResponse> {
    const response = await api.get<TeacherListResponse>("/teachers", { params });
    return response.data;
  },

  /**
   * Get a specific teacher by ID
   */
  async getTeacher(id: number): Promise<Teacher> {
    const response = await api.get<Teacher>(`/teachers/${id}`);
    return response.data;
  },

  /**
   * Create a new teacher
   */
  async createTeacher(data: TeacherCreate): Promise<Teacher> {
    const response = await api.post<Teacher>("/teachers", data);
    return response.data;
  },

  /**
   * Update a teacher
   */
  async updateTeacher(id: number, data: TeacherUpdate): Promise<Teacher> {
    const response = await api.put<Teacher>(`/teachers/${id}`, data);
    return response.data;
  },

  /**
   * Delete (archive) a teacher
   */
  async deleteTeacher(id: number): Promise<void> {
    await api.delete(`/teachers/${id}`);
  },

  /**
   * Toggle teacher status (active/inactive)
   */
  async toggleTeacherStatus(id: number, archived: boolean): Promise<Teacher> {
    return this.updateTeacher(id, { archived });
  },

  /**
   * Assign a course to a teacher
   */
  async assignCourse(
    teacherId: number,
    assignment: TeacherCourseAssignment
  ): Promise<Teacher> {
    const response = await api.post<Teacher>(
      `/teachers/${teacherId}/courses`,
      assignment
    );
    return response.data;
  },

  /**
   * Remove a course from a teacher
   */
  async removeCourse(teacherId: number, courseId: number): Promise<void> {
    await api.delete(`/teachers/${teacherId}/courses/${courseId}`);
  },

  /**
   * Import teachers from CSV
   */
  async importCSV(file: File): Promise<CSVImportResult> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post<CSVImportResult>(
      "/teachers/import-csv",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  /**
   * Export teachers to CSV
   */
  async exportCSV(params?: { status?: "active" | "inactive" }): Promise<Blob> {
    const response = await api.get("/teachers/export-csv", {
      params,
      responseType: "blob",
    });
    return response.data;
  },

  /**
   * Download exported CSV
   */
  downloadCSV(blob: Blob, filename: string = "teachers.csv") {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
