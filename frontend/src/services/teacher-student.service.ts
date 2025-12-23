import api from "@/lib/api";
import type { EvaluationResult } from "@/dtos";

type StudentListItem = {
  id: number;
  name: string;
  email: string;
  class_name?: string | null;
  status: string;
};

type StudentOverviewResponse = {
  peerResults: EvaluationResult[];
  competencyProfile: Array<{ category: string; value: number }>;
  learningGoals: Array<{
    id: string;
    title: string;
    status: string;
    related?: string;
    since?: string;
  }>;
  reflections: Array<{
    id: string;
    title: string;
    type: string;
    date: string;
  }>;
  projectResults: Array<{
    id: string;
    project: string;
    meta?: string;
    opdrachtgever?: string;
    periode?: string;
    eindcijfer?: number;
    proces?: number;
    eindresultaat?: number;
    communicatie?: number;
  }>;
};

export const teacherStudentService = {
  /**
   * List all students for the current teacher's school
   */
  async listStudents(params?: {
    q?: string;
    status?: "active" | "inactive";
    limit?: number;
  }): Promise<StudentListItem[]> {
    const queryParams = new URLSearchParams();
    
    if (params?.q) queryParams.set("q", params.q);
    if (params?.status) queryParams.set("status", params.status);
    if (params?.limit) queryParams.set("limit", params.limit.toString());

    const { data } = await api.get<StudentListItem[]>(
      `/students?${queryParams.toString()}`
    );
    return data;
  },

  /**
   * Get comprehensive overview data for a specific student
   * This fetches the same data as the student dashboard overview tab
   */
  async getStudentOverview(studentId: number): Promise<StudentOverviewResponse> {
    const { data } = await api.get<StudentOverviewResponse>(
      `/teacher/students/${studentId}/overview`
    );
    return data;
  },
};
