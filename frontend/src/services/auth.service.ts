import api, { baseURL, fetchWithErrorHandling } from "@/lib/api";
import { User } from "@/dtos/user.dto";
import { get_role_home_path } from "@/lib/role-utils";

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
   * Uses POST + fetch to avoid navigation, then fetches user and redirects based on role
   */
  async devLogin(email: string, returnTo?: string): Promise<void> {
    // Build URL with query parameters for POST request
    let url = `${baseURL}/auth/dev-login?email=${encodeURIComponent(email)}`;
    if (returnTo) {
      url += `&return_to=${encodeURIComponent(returnTo)}`;
    }

    try {
      // POST request to dev-login endpoint using fetchWithErrorHandling for better error messages
      // Backend sets HttpOnly cookie and returns redirect, but we handle it manually
      await fetchWithErrorHandling(url, {
        method: "POST",
        credentials: "include", // Important: include cookies in request/response
      });

      // Fetch current user to determine role
      const userResponse = await api.get<User>("/auth/me");
      const user = userResponse.data;

      // Redirect to returnTo or role-specific home
      if (returnTo) {
        window.location.href = returnTo;
      } else {
        const homePath = get_role_home_path(user.role);
        window.location.href = homePath;
      }
    } catch (error) {
      console.error("Dev-login error:", error);
      throw error;
    }
  },
};
