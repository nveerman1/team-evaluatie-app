import axios from "axios";

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
      console.error(`[API AUTH ERROR ${status}]`, friendlyMessage);
      
      // Enhance error with friendly message
      if (err.response) {
        err.response.data = {
          ...err.response.data,
          friendlyMessage,
        };
      }
    } else {
      console.error("[API NETWORK ERROR]", err?.message || err);
    }
    
    return Promise.reject(err);
  },
);

export default instance;
