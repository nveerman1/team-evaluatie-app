"use client";

import { useCurrentUser } from "./useCurrentUser";

/**
 * Enhanced auth hook that provides user, role, and schoolId
 * This is the source of truth for RBAC in the frontend
 */
export function useAuth() {
  const { user, loading, error } = useCurrentUser();

  return {
    user: user || null,
    role: user?.role || null,
    schoolId: user?.school_id || null,
    loading,
    error,
    isAdmin: user?.role === "admin",
    isTeacher: user?.role === "teacher",
    isStudent: user?.role === "student",
  };
}
