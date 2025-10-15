"use client";

import api from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

/** Types **/
type EvalStatus = "draft" | "open" | "closed";

type Evaluation = {
  id: number;
  title: string;
  status: EvalStatus;
  rubric_id?: number | null;
  course_id?: number | null; // cluster id
  deadlines?: { review?: string | null; reflection?: string | null } | null;
};

type ApiListResponse = Evaluation[];
type CourseLite = { id: number; name: string };

/** UI helpers **/
const STATUSES_FILTER = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

const STATUS_LABEL: Record<EvalStatus, string> = {
  draft: "draft",
  open: "open",
  closed: "closed",
};

function StatusBadge({ status }: { status: EvalStatus }) {
  const styles: Record<EvalStatus, string> = {
    draft: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
    open: "bg-green-50 text-green-700 ring-1 ring-green-200",
    closed: "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
  };
  return (
    <span
      className={`px-2 py-1 rounded-lg text-xs font-medium ${styles[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function useUrlState() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const query = sp.get("q") ?? "";
  const status = sp.get("status") ?? "";
  const courseId = sp.get("course_id") ?? "";

  function setParams(next: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(sp.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (v === undefined || v === "") params.delete(k);
      else params.set(k, String(v));
    });
    router.replace(`${pathname}?${params.toString()}`);
  }

  return { query, status, courseId, setParams };
}

/** Page **/
export default function EvaluationsListPage() {
  const { query, status, courseId, setParams } = useUrlState();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Evaluation[]>([]);
  const [error, setError] = useState<string | null>(null);

  // clusters map
  const [clusters, setClusters] = useState<CourseLite[]>([]);
  const clusterNameById = useMemo(() => {
    const m = new Map<number, string>();
    clusters.forEach((c) => m.set(c.id, c.name ?? `Course #${c.id}`));
    return m;
  }, [clusters]);

  // inline saving state (per id)
  const [savingId, setSavingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Fetch clusters once
  useEffect(() => {
    api
      .get<CourseLite[]>("/students/courses")
      .then((r) => setClusters(Array.isArray(r.data) ? r.data : []))
      .catch(() => setClusters([]));
  }, []);

  // Fetch evaluations with current filters
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    if (courseId) params.set("course_id", courseId);

    setLoading(true);
    setError(null);

    api
      .get<ApiListResponse>(
        `/evaluations${params.size ? `?${params.toString()}` : ""}`,
      )
      .then((r) => setRows(r.data ?? []))
      .catch((e) => setError(e?.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [query, status, courseId]);

  const filtered = useMemo(() => rows, [rows]); // server filtert al

  async function changeStatus(id: number, next: EvalStatus) {
    const prev = rows.find((x) => x.id === id)?.status;
    if (!prev || prev === next) return;
    setSavingId(id);
    // optimistisch updaten
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status: next } : x)));
    try {
      await api.patch(`/evaluations/${id}/status`, { status: next });
      setToast(`Status aangepast naar “${STATUS_LABEL[next]}”.`);
      setTimeout(() => setToast(null), 1500);
    } catch (e: any) {
      // rollback
      setRows((r) => r.map((x) => (x.id === id ? { ...x, status: prev } : x)));
      setToast(
        e?.response?.data?.detail || e?.message || "Status wijzigen mislukt",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Evaluaties</h1>
          <p className="text-gray-600">
            Beheer evaluaties en open het dashboard per evaluatie.
          </p>
        </div>
        <a
          href="/teacher/evaluations/create"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black text-white hover:opacity-90"
        >
          + Nieuwe evaluatie
        </a>
      </header>

      {/* Filters */}
      <section className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Zoek titel…"
          defaultValue={query}
          onChange={(e) => setParams({ q: e.target.value })}
          className="px-3 py-2 rounded-lg border w-64"
        />
        <select
          value={status}
          onChange={(e) => setParams({ status: e.target.value })}
          className="px-3 py-2 rounded-lg border"
        >
          {STATUSES_FILTER.map((s) => (
            <option key={s.value} value={s.value}>
              Status: {s.label}
            </option>
          ))}
        </select>
        <select
          value={courseId}
          onChange={(e) => setParams({ course_id: e.target.value })}
          className="px-3 py-2 rounded-lg border w-56"
          title="Filter op cluster"
        >
          <option value="">Alle clusters</option>
          {clusters.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name ?? `Course #${c.id}`}
            </option>
          ))}
        </select>
        {(query || status || courseId) && (
          <button
            onClick={() => setParams({ q: "", status: "", course_id: "" })}
            className="px-3 py-2 rounded-lg border"
          >
            Reset
          </button>
        )}
      </section>

      {/* Toast */}
      {toast && (
        <div className="p-3 rounded-lg bg-gray-100 text-gray-800">{toast}</div>
      )}

      {/* Table */}
      <section className="bg-white border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_220px_220px_minmax(280px,1fr)] gap-0 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-600">
          <div>Titel</div>
          <div>Status</div>
          <div>Deadlines</div>
          <div className="flex justify-end gap-2 pr-2 shrink-0 whitespace-nowrap">
            Acties
          </div>
        </div>

        {loading && <div className="p-6 text-gray-500">Laden…</div>}
        {error && !loading && (
          <div className="p-6 text-red-600">Fout: {error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="p-6 text-gray-500">Geen evaluaties gevonden.</div>
        )}

        {!loading &&
          !error &&
          filtered.map((e) => {
            const deadlineReview = e?.deadlines?.review
              ? new Date(e.deadlines.review).toLocaleDateString()
              : "—";
            const deadlineReflection = e?.deadlines?.reflection
              ? new Date(e.deadlines.reflection).toLocaleDateString()
              : "—";

            const clusterName =
              e.course_id != null
                ? (clusterNameById.get(e.course_id) ?? `Course #${e.course_id}`)
                : "—";

            return (
              <div
                key={e.id}
                className="grid grid-cols-[1fr_220px_220px_minmax(280px,1fr)] items-start gap-0 px-4 py-3 border-t text-sm"
              >
                <div>
                  <div className="font-medium">{e.title}</div>
                  <div className="text-gray-500">cluster: {clusterName}</div>
                </div>

                {/* Status + inline switcher */}
                <select
                  className="appearance-none bg-gray-50 border border-gray-300 text-gray-700 text-xs rounded-md px-2 py-1 pr-5
                            hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                            cursor-pointer transition-all w-[110px]"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath fill='none' stroke='%23666' stroke-width='1.5' d='M1 1l4 4 4-4'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 0.4rem center",
                    backgroundSize: "10px 6px",
                  }}
                  value={e.status}
                  disabled={savingId === e.id}
                  onChange={(ev) =>
                    changeStatus(e.id, ev.target.value as EvalStatus)
                  }
                  title="Wijzig status"
                >
                  <option value="draft">Draft</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>

                {/* Deadlines */}
                <div className="text-gray-600">
                  <div>review: {deadlineReview}</div>
                  <div>reflectie: {deadlineReflection}</div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pr-2 shrink-0 whitespace-nowrap">
                  <Link
                    href={`/teacher/evaluations/${e.id}/dashboard`}
                    className="px-2 py-1 rounded-lg border hover:bg-gray-50"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href={`/teacher/evaluations/${e.id}/grades`}
                    className="px-2 py-1 rounded-lg border hover:bg-gray-50"
                  >
                    Cijfers
                  </Link>
                  <Link
                    href={`/teacher/evaluations/${e.id}/settings`}
                    className="px-2 py-1 rounded-lg border hover:bg-gray-50"
                  >
                    Instellingen
                  </Link>
                </div>
              </div>
            );
          })}
      </section>
    </main>
  );
}
