import axios from "axios";

/**
 * Custom error class for API authentication/authorization errors (401/403).
 * This allows the application to distinguish between auth errors and other API errors,
 * and handle business-case 403 responses (e.g., "no self-assessment yet") gracefully
 * without logging unnecessary console errors.
 */
export class ApiAuthError extends Error {
  status: number;
  friendlyMessage: string;
  originalMessage: string;

  constructor(status: number, friendlyMessage: string, originalMessage: string) {
    super(friendlyMessage);
    this.name = "ApiAuthError";
    this.status = status;
    this.friendlyMessage = friendlyMessage;
    this.originalMessage = originalMessage;
  }
}

// Gebruik de env-variabele als die bestaat, anders fallback
const baseURL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "http://localhost:8000/api/v1";

const instance = axios.create({
  baseURL,
  timeout: 15000,
});

// Request interceptor – standaard headers instellen
instance.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  config.headers["X-User-Email"] =
    config.headers["X-User-Email"] ?? "docent@example.com";
  config.headers["Content-Type"] =
    config.headers["Content-Type"] ?? "application/json";
  return config;
});

// Response interceptor – nette foutmelding
instance.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    
    if (status === 401 || status === 403) {
      const friendlyMessage = "Geen toegang of sessie verlopen. Log opnieuw in.";
      const originalMessage = err?.response?.data?.detail || err?.message || "Auth error";
      
      // Log the auth error for debugging
      console.error(`[API AUTH ERROR ${status}]`, friendlyMessage);
      
      // Throw ApiAuthError instead of the raw axios error
      throw new ApiAuthError(status, friendlyMessage, originalMessage);
    } else {
      console.error("[API NETWORK ERROR]", err?.message || err);
    }
    
    return Promise.reject(err);
  },
);

export default instance;
