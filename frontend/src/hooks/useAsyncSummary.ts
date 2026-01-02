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
      console.log(`[useAsyncSummary] Polling job ${currentJobId}...`);
      const jobStatus = await feedbackSummaryService.getJobStatus(currentJobId);
      console.log(`[useAsyncSummary] Poll response for ${currentJobId}:`, jobStatus);
      
      if (!mountedRef.current) return;

      setStatus(jobStatus.status);

      if (jobStatus.status === "completed" && jobStatus.result) {
        console.log(`[useAsyncSummary] Job completed! Extracting summary from result`);
        setSummary(jobStatus.result.summary_text);
        setGenerationMethod(jobStatus.result.generation_method);
        setFeedbackCount(jobStatus.result.feedback_count);
        setIsPolling(false);
        console.log(`[useAsyncSummary] Stopping polling, summary set: ${jobStatus.result.summary_text.substring(0, 50)}...`);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } else if (jobStatus.status === "failed") {
        console.log(`[useAsyncSummary] Job failed during polling:`, jobStatus.error_message);
        setError(jobStatus.error_message || "Generation failed");
        setIsPolling(false);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } else {
        console.log(`[useAsyncSummary] Job still in progress, status: ${jobStatus.status}`);
      }
      // Keep polling for "queued" and "processing" states
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error("[useAsyncSummary] Error polling job status:", err);
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
      console.log(`[useAsyncSummary] Queueing job for evaluation ${evaluationId}, student ${studentId}`);
      const jobResponse = await feedbackSummaryService.queueSummaryGeneration(
        evaluationId,
        studentId
      );

      if (!mountedRef.current) return;

      console.log(`[useAsyncSummary] Queue response:`, jobResponse);
      console.log(`[useAsyncSummary] Response status: ${jobResponse.status}, has result: ${!!jobResponse.result}`);
      if (jobResponse.result) {
        console.log(`[useAsyncSummary] Result details:`, {
          summary_text: jobResponse.result.summary_text?.substring(0, 50) + '...',
          generation_method: jobResponse.result.generation_method,
          feedback_count: jobResponse.result.feedback_count
        });
      }
      
      setJobId(jobResponse.job_id);
      setStatus(jobResponse.status);

      // Start polling if job is queued or processing
      if (jobResponse.status === "queued" || jobResponse.status === "processing") {
        console.log(`[useAsyncSummary] Starting polling for job ${jobResponse.job_id} with status ${jobResponse.status}`);
        startPolling(jobResponse.job_id);
      } else if (jobResponse.status === "completed" && jobResponse.result) {
        // Job already completed
        console.log(`[useAsyncSummary] Job already completed, setting summary from result`);
        setSummary(jobResponse.result.summary_text);
        setGenerationMethod(jobResponse.result.generation_method);
        setFeedbackCount(jobResponse.result.feedback_count);
        console.log(`[useAsyncSummary] Summary state updated: ${jobResponse.result.summary_text.substring(0, 50)}...`);
      } else if (jobResponse.status === "failed") {
        console.log(`[useAsyncSummary] Job failed:`, jobResponse.error_message);
        setError(jobResponse.error_message || "Generation failed");
      } else {
        console.warn(`[useAsyncSummary] Unexpected branch - status: ${jobResponse.status}, has result: ${!!jobResponse.result}`);
        console.warn(`[useAsyncSummary] Full response:`, jobResponse);
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error("[useAsyncSummary] Error starting generation:", err);
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

  // Auto-start on mount (if autoStart is true)
  useEffect(() => {
    if (autoStart && status === "idle") {
      startGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array - only run on mount

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
