// frontend/src/lib/api.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

/**
 * Custom error class for API authentication/authorization errors (401/403).
 * Hiermee kun je 401/403 apart afhandelen (bijv. melding tonen of naar login sturen)
 * zonder overal op axios-fouten te hoeven switchen.
 */
export class ApiAuthError extends Error {
  status: number;
  friendlyMessage: string;
  originalMessage: string;

  constructor(
    status: number,
    friendlyMessage: string,
    originalMessage: string,
  ) {
    super(friendlyMessage);
    this.name = "ApiAuthError";
    this.status = status;
    this.friendlyMessage = friendlyMessage;
    this.originalMessage = originalMessage;
  }
}

// Base URL configuration:
// - In production: defaults to "/api/v1" (relative path, nginx proxies to backend)
// - In development: defaults to "/api/v1" (Next.js rewrites proxy to backend)
// - Can be overridden with NEXT_PUBLIC_API_BASE_URL env var (e.g., for external API)
const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

export const baseURL = raw?.replace(/\/+$/, "") ?? "/api/v1";

// Development sanity check - log baseURL to help debug API issues
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  // Only log once on initial load
  if (!(window as any).__API_BASE_URL_LOGGED__) {
    console.log("[API Client] baseURL:", baseURL);
    console.log("[API Client] Full API endpoint example:", `${window.location.origin}${baseURL}/auth/me`);
    (window as any).__API_BASE_URL_LOGGED__ = true;
  }
}

const instance = axios.create({
  baseURL,
  timeout: 60000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// ---- REQUEST INTERCEPTOR ----
// Zet X-User-Email altijd vanuit storage en voorkom hardcoded/legacy defaults.
instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Alleen in de browser (SSR heeft geen storage)
  if (typeof window !== "undefined") {
    const email =
      localStorage.getItem("x_user_email") ||
      sessionStorage.getItem("x_user_email");
    if (email) {
      config.headers.set("X-User-Email", email);
    }
  }

  // Content-Type (laat bestaande staan als die expliciet is gezet)
  if (!config.headers.has("Content-Type")) {
    config.headers.set("Content-Type", "application/json");
  }

  return config;
});

// ---- RESPONSE INTERCEPTOR ----
instance.interceptors.response.use(
  (res) => res,
  (err: AxiosError<any>) => {
    // Don't log or handle canceled/aborted requests
    // Check multiple conditions for canceled requests
    if (
      axios.isCancel(err) || 
      err.code === 'ERR_CANCELED' || 
      err.message === 'canceled' ||
      err.name === 'CanceledError' ||
      err.name === 'AbortError'
    ) {
      return Promise.reject(err);
    }

    const status = err?.response?.status;

    if (status === 401 || status === 403) {
      // Different messages for 401 vs 403
      const friendlyMessage = status === 401
        ? "Sessie verlopen. Log opnieuw in."
        : "Geen toegang tot deze resource.";
      const originalMessage =
        (err.response?.data as any)?.detail || err.message || "Auth error";

      // Niet dubbel loggen; gooi een nette ApiAuthError
      throw new ApiAuthError(status, friendlyMessage, originalMessage);
    }

    // Netwerk/overige fouten één keer loggen
    // (bijv. 404/500 of geen response door netwerkfout)
    // Silently ignore 404 errors for /users/me endpoint - it's expected when not authenticated
    const isUserMeNotFound = status === 404 && err.config?.url?.includes('/users/me');
    if (!isUserMeNotFound) {
      const tag = err.response ? "[API ERROR]" : "[API NETWORK ERROR]";
      // eslint-disable-next-line no-console
      console.error(tag, err.message || err);
    }
    return Promise.reject(err);
  },
);

/**
 * Helper for direct fetch() calls that need better error messages
 * Use this for endpoints not yet migrated to axios
 */
export async function fetchWithErrorHandling(url: string, options?: RequestInit): Promise<Response> {
  try {
    // Get X-User-Email from storage (same as axios interceptor)
    let xUserEmail: string | null = null;
    if (typeof window !== 'undefined') {
      xUserEmail = localStorage.getItem('x_user_email') || sessionStorage.getItem('x_user_email');
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string> || {}),
    };

    // Add X-User-Email header if available (for dev-login)
    if (xUserEmail) {
      headers['X-User-Email'] = xUserEmail;
    }

    const response = await fetch(url, {
      ...options,
      credentials: options?.credentials || 'include',
      headers,
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        const text = await response.text();
        errorBody = text.substring(0, 2000); // Trim to 2k max
        
        // Try parsing as JSON for better error message
        try {
          const json = JSON.parse(text);
          if (json.detail) {
            errorBody = json.detail;
          }
        } catch {
          // Not JSON, use text
        }
      } catch {
        errorBody = 'Could not read response body';
      }

      const errorInfo = {
        url,
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
      };

      // Log to console for debugging
      console.error('[FETCH ERROR]', errorInfo);

      // Throw error with details
      throw new Error(
        `HTTP ${response.status} ${response.statusText}: ${errorBody}\nURL: ${url}`
      );
    }

    return response;
  } catch (error) {
    // Network error or thrown error from above
    if (error instanceof Error && error.message.includes('HTTP')) {
      // Already formatted, rethrow
      throw error;
    }
    
    // Network error
    console.error('[NETWORK ERROR]', { url, error });
    throw new Error(`Network error fetching ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export default instance;
