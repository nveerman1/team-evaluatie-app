"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { feedbackSummaryService } from "@/services";
import type { JobStatusResponse, FeedbackSummaryResponse } from "@/dtos/feedback-summary.dto";

type UseAsyncSummaryResult = {
  summary: string | null;
  status: "idle" | "queued" | "processing" | "completed" | "failed" | "loading";
  error: string | null;
  generationMethod: string | null;
  feedbackCount: number;
  jobId: string | null;
  startGeneration: () => Promise<void>;
  retryGeneration: () => Promise<void>;
  isPolling: boolean;
};

/**
 * Hook for managing async AI summary generation with automatic polling.
 * 
 * @param evaluationId - The evaluation ID
 * @param studentId - The student ID
 * @param autoStart - Whether to automatically start generation on mount (default: true)
 * @param pollingInterval - Polling interval in ms (default: 3000)
 */
export function useAsyncSummary(
  evaluationId: number,
  studentId: number,
  options: {
    autoStart?: boolean;
    pollingInterval?: number;
    useSync?: boolean; // Fallback to sync mode
  } = {}
): UseAsyncSummaryResult {
  const { autoStart = true, pollingInterval = 3000, useSync = false } = options;

  const [summary, setSummary] = useState<string | null>(null);
  const [status, setStatus] = useState<UseAsyncSummaryResult["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [generationMethod, setGenerationMethod] = useState<string | null>(null);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Poll job status
  const pollJobStatus = useCallback(async (currentJobId: string) => {
    if (!mountedRef.current) return;

    try {
      const jobStatus = await feedbackSummaryService.getJobStatus(currentJobId);
      
      if (!mountedRef.current) return;

      setStatus(jobStatus.status);

      if (jobStatus.status === "completed" && jobStatus.result) {
        setSummary(jobStatus.result.summary_text);
        setGenerationMethod(jobStatus.result.generation_method);
        setFeedbackCount(jobStatus.result.feedback_count);
        setIsPolling(false);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } else if (jobStatus.status === "failed") {
        setError(jobStatus.error_message || "Generation failed");
        setIsPolling(false);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
      // Keep polling for "queued" and "processing" states
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error("Error polling job status:", err);
      // Don't stop polling on error, might be transient
    }
  }, []);

  // Start polling
  const startPolling = useCallback((currentJobId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    setIsPolling(true);
    pollingIntervalRef.current = setInterval(() => {
      pollJobStatus(currentJobId);
    }, pollingInterval);

    // Initial poll
    pollJobStatus(currentJobId);
  }, [pollJobStatus, pollingInterval]);

  // Start generation (async mode)
  const startGenerationAsync = useCallback(async () => {
    if (!mountedRef.current) return;

    setStatus("loading");
    setError(null);

    try {
      // Queue the job
      const jobResponse = await feedbackSummaryService.queueSummaryGeneration(
        evaluationId,
        studentId
      );

      if (!mountedRef.current) return;

      setJobId(jobResponse.job_id);
      setStatus(jobResponse.status);

      // Start polling if job is queued or processing
      if (jobResponse.status === "queued" || jobResponse.status === "processing") {
        startPolling(jobResponse.job_id);
      } else if (jobResponse.status === "completed" && jobResponse.result) {
        // Job already completed
        setSummary(jobResponse.result.summary_text);
        setGenerationMethod(jobResponse.result.generation_method);
        setFeedbackCount(jobResponse.result.feedback_count);
      } else if (jobResponse.status === "failed") {
        setError(jobResponse.error_message || "Generation failed");
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error("Error starting generation:", err);
      setError(err?.response?.data?.detail || err?.message || "Failed to start generation");
      setStatus("failed");
    }
  }, [evaluationId, studentId, startPolling]);

  // Start generation (sync mode fallback)
  const startGenerationSync = useCallback(async () => {
    if (!mountedRef.current) return;

    setStatus("loading");
    setError(null);

    try {
      const result = await feedbackSummaryService.getStudentSummary(
        evaluationId,
        studentId
      );

      if (!mountedRef.current) return;

      setSummary(result.summary_text);
      setGenerationMethod(result.generation_method);
      setFeedbackCount(result.feedback_count);
      setStatus("completed");
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error("Error in sync generation:", err);
      setError(err?.response?.data?.detail || err?.message || "Failed to generate summary");
      setStatus("failed");
    }
  }, [evaluationId, studentId]);

  // Choose mode
  const startGeneration = useCallback(async () => {
    if (useSync) {
      await startGenerationSync();
    } else {
      await startGenerationAsync();
    }
  }, [useSync, startGenerationSync, startGenerationAsync]);

  // Retry generation
  const retryGeneration = useCallback(async () => {
    setError(null);
    setStatus("idle");
    await startGeneration();
  }, [startGeneration]);

  // Auto-start on mount
  useEffect(() => {
    if (autoStart && status === "idle") {
      startGeneration();
    }
  }, [autoStart]); // Only run on mount

  return {
    summary,
    status,
    error,
    generationMethod,
    feedbackCount,
    jobId,
    startGeneration,
    retryGeneration,
    isPolling,
  };
}
