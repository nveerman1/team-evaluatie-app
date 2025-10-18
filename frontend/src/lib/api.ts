import axios from "axios";

const instance = axios.create({
  baseURL: "http://localhost:8000/api/v1", // ends with /api/v1
  timeout: 15000,
});

instance.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  config.headers["X-User-Email"] =
    config.headers["X-User-Email"] ?? "docent@example.com";
  config.headers["Content-Type"] =
    config.headers["Content-Type"] ?? "application/json";
  return config;
});

instance.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error("[API NETWORK ERROR]", err?.message || err);
    return Promise.reject(err);
  },
);

export default instance;
