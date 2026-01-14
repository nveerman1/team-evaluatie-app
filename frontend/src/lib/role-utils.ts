/**
 * Utility functions for role-based routing
 */

export type UserRole = "admin" | "teacher" | "student";

/**
 * Get the home path for a given user role
 */
export function get_role_home_path(role: UserRole | string | null): string {
  if (role === "admin" || role === "teacher") {
    return "/teacher";
  } else if (role === "student") {
    return "/student";
  }
  // Default fallback
  return "/";
}
