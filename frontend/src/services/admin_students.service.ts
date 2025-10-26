import api from "@/lib/api";
import type {
  AdminStudent,
  AdminStudentCreate,
  AdminStudentUpdate,
} from "@/dtos/admin_students.dto";

export interface AdminStudentsQuery {
  page?: number; // 1-based
  page_size?: number; // default per jouw backend
  q?: string; // search
  course?: string; // filter by course name
  status?: "active" | "inactive" | "all";
}

export async function listAdminStudents(params: AdminStudentsQuery = {}) {
  const res = await api.get("/admin/students", { params });
  const items: AdminStudent[] = Array.isArray(res.data)
    ? res.data
    : (res.data?.items ?? []);

  // X-Total-Count als die door BE gezet wordt; anders fallback
  const totalHeader = (res.headers?.["x-total-count"] ??
    res.headers?.["X-Total-Count"] ??
    "") as string;
  const total = Number.parseInt(totalHeader, 10);
  return { items, total: Number.isFinite(total) ? total : items.length };
}

export async function getAdminStudent(id: number) {
  const res = await api.get(`/admin/students/${id}`);
  return res.data as AdminStudent;
}

export async function createAdminStudent(payload: AdminStudentCreate) {
  const res = await api.post("/admin/students", payload);
  return res.data as AdminStudent;
}

export async function updateAdminStudent(
  id: number,
  payload: AdminStudentUpdate,
) {
  const res = await api.put(`/admin/students/${id}`, payload);
  return res.data as AdminStudent;
}

export async function deleteAdminStudent(id: number) {
  await api.delete(`/admin/students/${id}`);
}
