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
    console.error("[API NETWORK ERROR]", err?.message || err);
    return Promise.reject(err);
  },
);

export default instance;
