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
  redirectToAzureLogin(schoolId: number, returnTo?: string): void {
    let url = `${baseURL}/auth/azure?school_id=${schoolId}`;
    if (returnTo) {
      url += `&return_to=${encodeURIComponent(returnTo)}`;
    }
    window.location.href = url;
  },

  /**
   * Development-only login (requires ENABLE_DEV_LOGIN=true on backend)
   */
  devLogin(email: string, returnTo?: string): void {
    let url = `${baseURL}/auth/dev-login?email=${encodeURIComponent(email)}`;
    if (returnTo) {
      url += `&return_to=${encodeURIComponent(returnTo)}`;
    }
    window.location.href = url;
  },
};
