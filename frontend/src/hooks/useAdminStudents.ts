import { useCallback, useEffect, useMemo, useState } from "react";
import { errorMsg } from "@/lib/errors";
import type {
  AdminStudent,
  AdminStudentCreate,
  AdminStudentUpdate,
} from "@/dtos/admin_students.dto";
import {
  listAdminStudents,
  createAdminStudent,
  updateAdminStudent,
  deleteAdminStudent,
  getAdminStudent,
  type AdminStudentsQuery,
} from "@/services/admin_students.service";

export function useAdminStudents(initial: AdminStudentsQuery = {}) {
  const [params, setParams] = useState<AdminStudentsQuery>(initial);
  const [data, setData] = useState<AdminStudent[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = useCallback(async (p: AdminStudentsQuery) => {
    setLoading(true);
    setErr(null);
    try {
      const { items, total } = await listAdminStudents(p);
      setData(items);
      setTotal(total);
    } catch (e) {
      setErr(errorMsg(e, "Laden van leerlingen mislukte"));
    } finally {
      setLoading(false);
    }
  }, []);

  // initial + when params change
  useEffect(() => {
    void fetchData(params);
  }, [fetchData, params]);

  const refresh = useCallback(
    () => void fetchData(params),
    [fetchData, params],
  );

  return {
    data,
    total,
    loading,
    error: err,
    params,
    setParams,
    refresh,
  };
}

export function useAdminStudent(id?: number) {
  const [student, setStudent] = useState<AdminStudent | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    getAdminStudent(id)
      .then((s) => setStudent(s))
      .catch((e) => setErr(errorMsg(e, "Laden van leerling mislukte")))
      .finally(() => setLoading(false));
  }, [id]);

  return { student, loading, error: err };
}

export function useCreateAdminStudent(onSuccess?: (s: AdminStudent) => void) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mutate = useCallback(
    async (payload: AdminStudentCreate) => {
      setLoading(true);
      setErr(null);
      try {
        const s = await createAdminStudent(payload);
        onSuccess?.(s);
        return s;
      } catch (e) {
        const m = errorMsg(e, "Aanmaken mislukt");
        setErr(m);
        throw new Error(m);
      } finally {
        setLoading(false);
      }
    },
    [onSuccess],
  );

  return { create: mutate, loading, error: err };
}

export function useUpdateAdminStudent(onSuccess?: (s: AdminStudent) => void) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mutate = useCallback(
    async (id: number, payload: AdminStudentUpdate) => {
      setLoading(true);
      setErr(null);
      try {
        const s = await updateAdminStudent(id, payload);
        onSuccess?.(s);
        return s;
      } catch (e) {
        const m = errorMsg(e, "Opslaan mislukt");
        setErr(m);
        throw new Error(m);
      } finally {
        setLoading(false);
      }
    },
    [onSuccess],
  );

  return { update: mutate, loading, error: err };
}

export function useDeleteAdminStudent(onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mutate = useCallback(
    async (id: number) => {
      setLoading(true);
      setErr(null);
      try {
        await deleteAdminStudent(id);
        onSuccess?.();
      } catch (e) {
        const m = errorMsg(e, "Verwijderen mislukt");
        setErr(m);
        throw new Error(m);
      } finally {
        setLoading(false);
      }
    },
    [onSuccess],
  );

  return { remove: mutate, loading, error: err };
}
