import api from "@/lib/api";
import { CourseLite } from "@/dtos/course.dto";

export const courseService = {
  /**
   * Get list of courses/clusters
   */
  async getCourses(): Promise<CourseLite[]> {
    const response = await api.get<CourseLite[]>("/students/courses");
    return Array.isArray(response.data) ? response.data : [];
  },
};
