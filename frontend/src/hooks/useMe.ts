"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import { User } from "@/dtos";

/**
 * Hook to check authentication status and get current user.
 * Automatically redirects to login page on 401 errors.
 * 
 * This is the primary authentication check hook that should be used
 * in protected pages/components to ensure user is authenticated.
 */
export function useMe() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const userData = await authService.getCurrentUser();
        if (isMounted) {
          setUser(userData);
          setError(null);
        }
      } catch (err: any) {
        if (!isMounted) return;

        // Handle authentication errors (401/403)
        if (err.status === 401 || err.status === 403) {
          console.warn("Authentication failed, redirecting to login");
          // Redirect to login page
          router.push("/");
        } else {
          console.error("Failed to fetch current user:", err);
          setError(err instanceof Error ? err.message : "Failed to fetch user");
        }
        setUser(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return { user, loading, error };
}
