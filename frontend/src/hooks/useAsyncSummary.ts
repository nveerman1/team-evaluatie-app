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
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const hasStartedRef = useRef(false);
  const prevEvaluationIdRef = useRef(evaluationId);
  const prevStudentIdRef = useRef(studentId);

  // Reset state when evaluationId or studentId changes
  useEffect(() => {
    const evaluationChanged = prevEvaluationIdRef.current !== evaluationId;
    const studentChanged = prevStudentIdRef.current !== studentId;
    
    if (evaluationChanged || studentChanged) {
      console.log(`[useAsyncSummary] Props changed - evaluationId: ${prevEvaluationIdRef.current} -> ${evaluationId}, studentId: ${prevStudentIdRef.current} -> ${studentId}`);
      
      // Abort any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Stop any ongoing polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Reset all state to initial values
      setSummary(null);
      setStatus("idle");
      setError(null);
      setGenerationMethod(null);
      setFeedbackCount(0);
      setJobId(null);
      setIsPolling(false);
      
      // Allow auto-start to run again
      hasStartedRef.current = false;
      
      // Update refs
      prevEvaluationIdRef.current = evaluationId;
      prevStudentIdRef.current = studentId;
      
      console.log(`[useAsyncSummary] State reset complete for new evaluation/student`);
    }
  }, [evaluationId, studentId]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true; // Ensure it's true on mount
    return () => {
      mountedRef.current = false;
      
      // Abort any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // Poll job status
  const pollJobStatus = useCallback(async (currentJobId: string) => {
    if (!mountedRef.current) return;

    try {
      console.log(`[useAsyncSummary] Polling job ${currentJobId}...`);
      
      // Create new AbortController for each request
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      const jobStatus = await feedbackSummaryService.getJobStatus(
        currentJobId,
        controller.signal
      );
      console.log(`[useAsyncSummary] Poll response for ${currentJobId}:`, jobStatus);
      
      if (!mountedRef.current) return;

      if (jobStatus.status === "completed" && jobStatus.result) {
        console.log(`[useAsyncSummary] Job completed! Extracting summary from result`);
        setSummary(jobStatus.result.summary_text);
        setGenerationMethod(jobStatus.result.generation_method);
        setFeedbackCount(jobStatus.result.feedback_count);
        setStatus("completed"); // Set status AFTER setting summary
        setIsPolling(false);
        console.log(`[useAsyncSummary] Stopping polling, summary set: ${jobStatus.result.summary_text.substring(0, 50)}...`);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        // Clear abort controller after successful completion
        abortControllerRef.current = null;
      } else if (jobStatus.status === "failed") {
        console.log(`[useAsyncSummary] Job failed during polling:`, jobStatus.error_message);
        setStatus("failed");
        setError(jobStatus.error_message || "Generation failed");
        setIsPolling(false);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        // Clear abort controller after failure
        abortControllerRef.current = null;
      } else if (jobStatus.status === "queued" || jobStatus.status === "processing") {
        // Only update status if we're not already completed
        console.log(`[useAsyncSummary] Job still in progress, status: ${jobStatus.status}`);
        setStatus(jobStatus.status);
      } else {
        console.warn(`[useAsyncSummary] Unexpected job status during polling: ${jobStatus.status}`);
      }
      // Keep polling for "queued" and "processing" states
    } catch (err: any) {
      // Check if this was an abort/cancel - if so, don't log or handle it
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        console.log(`[useAsyncSummary] Polling aborted for job ${currentJobId}`);
        return;
      }
      
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

    console.log(`[useAsyncSummary] startGenerationAsync called - current status: ${status}`);
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

      // Handle different job statuses
      if (jobResponse.status === "completed" && jobResponse.result) {
        // Job already completed - set summary first, then status
        console.log(`[useAsyncSummary] Job already completed, setting summary from result`);
        setSummary(jobResponse.result.summary_text);
        setGenerationMethod(jobResponse.result.generation_method);
        setFeedbackCount(jobResponse.result.feedback_count);
        setStatus("completed"); // Set status AFTER setting summary
        console.log(`[useAsyncSummary] Summary state updated to completed: ${jobResponse.result.summary_text.substring(0, 50)}...`);
      } else if (jobResponse.status === "queued" || jobResponse.status === "processing") {
        setStatus(jobResponse.status);
        console.log(`[useAsyncSummary] Starting polling for job ${jobResponse.job_id} with status ${jobResponse.status}`);
        startPolling(jobResponse.job_id);
      } else if (jobResponse.status === "failed") {
        console.log(`[useAsyncSummary] Job failed:`, jobResponse.error_message);
        setStatus("failed");
        setError(jobResponse.error_message || "Generation failed");
      } else {
        console.warn(`[useAsyncSummary] Unexpected branch - status: ${jobResponse.status}, has result: ${!!jobResponse.result}`);
        console.warn(`[useAsyncSummary] Full response:`, jobResponse);
        setStatus(jobResponse.status);
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
    hasStartedRef.current = false; // Allow restart
    await startGeneration();
  }, [startGeneration]);

  // Auto-start generation when needed
  useEffect(() => {
    if (autoStart && status === "idle" && !hasStartedRef.current) {
      console.log(`[useAsyncSummary] Auto-starting generation for evaluation ${evaluationId}, student ${studentId}`);
      hasStartedRef.current = true;
      startGeneration();
    }
  }, [autoStart, status, evaluationId, studentId, startGeneration]);

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
