import api, { baseURL } from "@/lib/api";
import { User } from "@/dtos/user.dto";

export const authService = {
  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>("/auth/me");
    return response.data;
  },

  /**
   * Logout current user (clears cookie)
   */
  async logout(): Promise<void> {
    await api.post("/auth/logout");
  },

  /**
   * Redirect to Azure AD login
   */
  redirectToAzureLogin(schoolId: number): void {
    window.location.href = `${baseURL}/auth/azure?school_id=${schoolId}`;
  },
};
