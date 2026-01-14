import api, { baseURL } from "@/lib/api";
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
      // POST request to dev-login endpoint
      // Backend sets HttpOnly cookie and returns 302 redirect, but we handle it manually
      // Use redirect: 'manual' to prevent automatic following of redirects
      const response = await fetch(url, {
        method: "POST",
        credentials: "include", // Important: include cookies in request/response
        redirect: "manual", // Don't follow redirects automatically
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      // With redirect: 'manual', a 302 response becomes an opaque redirect
      // - response.type will be 'opaqueredirect'
      // - response.ok will be false
      // - response.status will be 0 (not 302!)
      // We accept this as success since the cookie is already set
      const isRedirect = response.type === 'opaqueredirect';
      const isSuccess = response.ok || isRedirect;

      if (!isSuccess) {
        let errorBody = '';
        try {
          const text = await response.text();
          const json = JSON.parse(text);
          errorBody = json.detail || text;
        } catch {
          errorBody = 'Login failed';
        }
        throw new Error(errorBody);
      }

      // Fetch current user to determine role (using the cookie that was just set)
      const userResponse = await api.get<User>("/auth/me");
      const user = userResponse.data;

      // Redirect to returnTo or role-specific home
      if (returnTo) {
        // returnTo should already be a proper path like "/teacher"
        // Full page navigation to ensure clean state
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
