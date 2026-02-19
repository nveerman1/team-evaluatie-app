/**
 * Centralized error handling utilities for the application.
 * Use these instead of raw try-catch with `any` types.
 */

import { ApiException } from "@/dtos/common.dto";

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiException) {
    return error.detail || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "detail" in error) {
    return String(error.detail);
  }
  return "Er is een onbekende fout opgetreden";
}

/**
 * Log error to console (and optionally to backend logging service)
 */
export function logError(error: unknown, context?: string): void {
  const message = getErrorMessage(error);
  console.error(context ? `[${context}] ${message}` : message, error);
  
  // TODO: Send to backend logging service for production monitoring
  // if (process.env.NODE_ENV === 'production') {
  //   sendToLoggingService({ message, context, error });
  // }
}

/**
 * Handle API error response and convert to ApiException
 */
export async function handleApiError(response: Response): Promise<never> {
  let detail = "API request failed";
  
  try {
    const data = await response.json();
    detail = data.detail || data.message || detail;
  } catch {
    // If response is not JSON, use status text
    detail = response.statusText || detail;
  }
  
  throw new ApiException(detail, response.status, detail);
}

/**
 * Safe async wrapper that handles errors gracefully
 * Usage: const [data, error] = await safeAsync(() => apiCall());
 */
export async function safeAsync<T>(
  fn: () => Promise<T>
): Promise<[T | null, Error | null]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    const err = error instanceof Error 
      ? error 
      : new Error(getErrorMessage(error));
    return [null, err];
  }
}

/**
 * Type guard to check if error is an API exception
 */
export function isApiException(error: unknown): error is ApiException {
  return error instanceof ApiException;
}

/**
 * Type guard to check if error has a specific status code
 */
export function hasStatusCode(error: unknown, code: number): boolean {
  return isApiException(error) && error.status === code;
}
