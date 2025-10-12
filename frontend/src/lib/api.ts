import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

api.interceptors.request.use((cfg) => {
  if (typeof window !== "undefined") {
    const email = localStorage.getItem("x_user_email");
    if (email) {
      cfg.headers = cfg.headers ?? {};
      cfg.headers["X-User-Email"] = email;
    }
  }
  return cfg;
});

export default api;
