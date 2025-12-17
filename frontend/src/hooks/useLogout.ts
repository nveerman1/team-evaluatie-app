"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";

/**
 * Hook for handling user logout
 */
export function useLogout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const logout = async () => {
    setLoading(true);
    setError(null);

    try {
      await authService.logout();
      // Redirect to login page
      router.push("/");
    } catch (err) {
      console.error("Logout failed:", err);
      setError(err instanceof Error ? err.message : "Logout failed");
      // Still redirect to login even if API call fails
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  return { logout, loading, error };
}
