"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { User } from "@/dtos";

/**
 * Hook to fetch the currently authenticated user
 */
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get<User>("/auth/me");
        setUser(response.data);
      } catch (err) {
        console.error("Failed to fetch current user:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch user");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return { user, loading, error };
}
