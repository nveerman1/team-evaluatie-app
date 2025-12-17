import api from "@/lib/api";

export type AdminStudent = {
  id: number;
  name: string;
  email: string;
  class_name?: string;
  course_name?: string;
  team_number?: number;
  status: "active" | "inactive";
};

export type AdminStudentListParams = {
  q?: string; // search query
  status_filter?: "active" | "inactive";
  course?: string;
  page?: number;
  limit?: number;
  sort?: "name" | "class_name" | "team_number" | "course_name";
  dir?: "asc" | "desc";
};

export type AdminStudentListResponse = {
  students: AdminStudent[];
  total: number;
};

export type AdminStudentCreate = {
  name: string;
  email: string;
  class_name?: string;
  course_name?: string;
  team_number?: number;
  status?: "active" | "inactive";
};

export type AdminStudentUpdate = {
  name?: string;
  email?: string;
  class_name?: string;
  course_name?: string;
  team_number?: number;
  status?: "active" | "inactive";
};

export const adminStudentService = {
  /**
   * List students with filtering and pagination
   */
  async listStudents(params: AdminStudentListParams = {}): Promise<AdminStudentListResponse> {
    const response = await api.get<AdminStudent[]>("/admin/students", { params });
    
    // Extract total count from X-Total-Count header
    const totalCount = response.headers?.["x-total-count"];
    const total = totalCount ? parseInt(totalCount, 10) : response.data.length;
    
    return {
      students: response.data,
      total,
    };
  },

  /**
   * Create a new student
   */
  async createStudent(data: AdminStudentCreate): Promise<AdminStudent> {
    const response = await api.post<AdminStudent>("/admin/students", data);
    return response.data;
  },

  /**
   * Update an existing student
   */
  async updateStudent(id: number, data: AdminStudentUpdate): Promise<AdminStudent> {
    const response = await api.put<AdminStudent>(`/admin/students/${id}`, data);
    return response.data;
  },

  /**
   * Delete a student
   */
  async deleteStudent(id: number): Promise<void> {
    await api.delete(`/admin/students/${id}`);
  },

  /**
   * Export students as CSV
   */
  async exportCSV(params: AdminStudentListParams = {}): Promise<Blob> {
    const response = await api.get("/admin/students/export.csv", {
      params,
      responseType: "blob",
    });
    return response.data;
  },

  /**
   * Import students from CSV
   */
  async importCSV(file: File): Promise<{
    created: number;
    updated: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await api.post<{
      created: number;
      updated: number;
      errors: Array<{ row: number; error: string }>;
    }>("/admin/students/import.csv", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    
    return response.data;
  },

  /**
   * Download CSV blob as file
   */
  downloadCSV(blob: Blob, filename = "students.csv") {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
