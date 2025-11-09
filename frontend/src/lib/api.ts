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

// Base URL: gebruik env als die is gezet, anders fallback
const baseURL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "http://localhost:8000/api/v1";

const instance = axios.create({
  baseURL,
  timeout: 25000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// ---- REQUEST INTERCEPTOR ----
// Zet X-User-Email altijd vanuit storage en voorkom hardcoded/legacy defaults.
instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const headers = (config.headers ?? {}) as Record<string, any>;

  // Verwijder eventuele eerder gezette header om overschrijven te voorkomen
  delete headers["X-User-Email"];

  // Alleen in de browser (SSR heeft geen storage)
  if (typeof window !== "undefined") {
    const email =
      localStorage.getItem("x_user_email") ||
      sessionStorage.getItem("x_user_email");
    if (email) {
      headers["X-User-Email"] = email;
    }
  }

  // Content-Type (laat bestaande staan als die expliciet is gezet)
  headers["Content-Type"] = headers["Content-Type"] ?? "application/json";

  config.headers = headers;
  return config;
});

// ---- RESPONSE INTERCEPTOR ----
instance.interceptors.response.use(
  (res) => res,
  (err: AxiosError<any>) => {
    const status = err?.response?.status;

    if (status === 401 || status === 403) {
      const friendlyMessage =
        "Geen toegang of sessie verlopen. Log opnieuw in.";
      const originalMessage =
        (err.response?.data as any)?.detail || err.message || "Auth error";

      // Niet dubbel loggen; gooi een nette ApiAuthError
      throw new ApiAuthError(status, friendlyMessage, originalMessage);
    }

    // Netwerk/overige fouten één keer loggen
    // (bijv. 404/500 of geen response door netwerkfout)
    const tag = err.response ? "[API ERROR]" : "[API NETWORK ERROR]";
    // eslint-disable-next-line no-console
    console.error(tag, err.message || err);
    return Promise.reject(err);
  },
);

export default instance;
