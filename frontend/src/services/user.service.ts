import api from "@/lib/api";
import { User } from "@/dtos/user.dto";

export const userService = {
  /**
   * Search users by role and query
   */
  async searchUsers(params: {
    role?: "student" | "teacher" | "admin";
    search?: string;
    page?: number;
    per_page?: number;
  }): Promise<User[]> {
    const response = await api.get<User[]>("/users", { params });
    return response.data;
  },
};
