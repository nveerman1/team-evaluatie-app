"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUrlState, useEvaluations, useCourses } from "@/hooks";
import { evaluationService } from "@/services";
import type { Evaluation, EvalStatus } from "@/dtos/evaluation.dto";
import { Loading, ErrorMessage, Toast } from "@/components";
import { formatDate } from "@/utils";

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

export default function EvaluationsListInner() {
  // URL state (q, status, course_id)
  const { q: query, status, course_id: courseIdStr, setParams } = useUrlState();
  const courseIdNum = courseIdStr ? Number(courseIdStr) : undefined;

  // Evaluations met filters
  const { evaluations, loading, error, setEvaluations } = useEvaluations({
    query,
    status,
    course_id: courseIdNum,
  });

  // Courses via hook
  const { courses, courseNameById } = useCourses();

  // UI state
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Klein UX: als er precies 1 course is en geen filter gezet, preselecteer die
  useEffect(() => {
    if (!courseIdStr && courses.length === 1) {
      setParams({ course_id: String(courses[0].id) });
    }
  }, [courseIdStr, courses, setParams]);

  async function changeStatus(id: number, next: EvalStatus) {
    const prev = evaluations.find((x) => x.id === id)?.status;
    if (!prev || prev === next) return;

    setSavingId(id);
    // Optimistic update
    setEvaluations((r: Evaluation[]) =>
      r.map((x) => (x.id === id ? { ...x, status: next } : x)),
    );
    try {
      await evaluationService.updateStatus(id, next);
      setToast(`Status aangepast naar "${STATUS_LABEL[next]}".`);
      setTimeout(() => setToast(null), 1500);
    } catch (e: any) {
      // Rollback
      setEvaluations((r: Evaluation[]) =>
        r.map((x) => (x.id === id ? { ...x, status: prev } : x)),
      );
      setToast(
        e?.response?.data?.detail || e?.message || "Status wijzigen mislukt",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function deleteEvaluation(id: number) {
    const evalTitle = evaluations.find((x) => x.id === id)?.title;
    if (!confirm(`Weet je zeker dat je de evaluatie "${evalTitle}" wilt verwijderen?`)) {
      return;
    }

    setDeletingId(id);
    try {
      await evaluationService.deleteEvaluation(id);
      setEvaluations((r: Evaluation[]) => r.filter((x) => x.id !== id));
      setToast("Evaluatie succesvol verwijderd.");
      setTimeout(() => setToast(null), 1500);
    } catch (e: any) {
      const errorMsg = e?.response?.data?.detail || e?.message || "Evaluatie verwijderen mislukt";
      setToast(errorMsg);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Evaluaties</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Beheer evaluaties en open het dashboard per evaluatie.
            </p>
          </div>
          <a
            href="/teacher/evaluations/create"
            className="mt-4 md:mt-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Nieuwe evaluatie
          </a>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

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

        {/* Course-filter */}
        <select
          value={courseIdStr || ""}
          onChange={(e) => setParams({ course_id: e.target.value })}
          className="px-3 py-2 rounded-lg border w-56"
          title="Filter op course"
        >
          <option value="">Alle courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {(query || status || courseIdStr) && (
          <button
            onClick={() => setParams({ q: "", status: "", course_id: "" })}
            className="px-3 py-2 rounded-lg border"
          >
            Reset
          </button>
        )}
      </section>

      {/* Toast */}
      {toast && <Toast message={toast} />}

      {/* Tabel */}
      <section className="bg-white border border-gray-200/80 shadow-sm rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_220px_220px_minmax(280px,1fr)] gap-0 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-600">
          <div>Titel</div>
          <div>Status</div>
          <div>Deadlines</div>
          <div className="flex justify-end gap-2 pr-2 shrink-0 whitespace-nowrap">
            Acties
          </div>
        </div>

        {loading && (
          <div className="p-6">
            <Loading />
          </div>
        )}
        {error && !loading && (
          <div className="p-6">
            <ErrorMessage message={`Fout: ${error}`} />
          </div>
        )}
        {!loading && !error && evaluations.length === 0 && (
          <div className="p-6 text-gray-500">Geen evaluaties gevonden.</div>
        )}

        {!loading &&
          !error &&
          evaluations.map((e) => {
            const deadlineReview = formatDate(e?.deadlines?.review);
            const deadlineReflection = formatDate(e?.deadlines?.reflection);

            return (
              <div
                key={e.id}
                className="grid grid-cols-[1fr_220px_220px_minmax(280px,1fr)] items-start gap-0 px-4 py-3 border-t text-sm"
              >
                <div>
                  <div className="font-medium">{e.title}</div>
                  <div className="text-gray-500">
                    course: {e.cluster ?? "—"}
                  </div>
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

                {/* Acties */}
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
                  <button
                    onClick={() => deleteEvaluation(e.id)}
                    disabled={deletingId === e.id}
                    className="px-2 py-1 rounded-lg border hover:bg-red-50 hover:text-red-600 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Verwijder evaluatie"
                  >
                    {deletingId === e.id ? "..." : "Verwijderen"}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </>
  );
}
