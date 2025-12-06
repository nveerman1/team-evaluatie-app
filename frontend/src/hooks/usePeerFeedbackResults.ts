"use client";

import { useEffect, useState, useCallback } from "react";
import { EvaluationResult } from "@/dtos";
import { peerFeedbackResultsService } from "@/services";

/**
 * Hook to fetch peer feedback results for the current student.
 * Returns data in OMZA format for the student results page.
 */
export function usePeerFeedbackResults() {
  const [items, setItems] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await peerFeedbackResultsService.getMyPeerResults();
      setItems(data);
    } catch (e: unknown) {
      const errorMessage =
        (e as { response?: { data?: { detail?: string } }; message?: string })
          ?.response?.data?.detail ||
        (e as { message?: string })?.message ||
        "Kon resultaten niet laden";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
