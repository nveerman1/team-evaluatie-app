"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUrlState, useEvaluations, useCourses } from "@/hooks";
import { evaluationService } from "@/services";
import type { Evaluation } from "@/dtos/evaluation.dto";
import { Loading, ErrorMessage, Toast } from "@/components";
import { formatDate } from "@/utils";

const STATUSES_FILTER = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

export default function EvaluationsListInner() {
  // URL state (q, status, course_id)
  const { q: query, status, course_id: courseIdStr, setParams } = useUrlState();
  const courseIdNum = courseIdStr ? Number(courseIdStr) : undefined;

  // Evaluations met filters - only show peer evaluations on this page
  const { evaluations, loading, error, setEvaluations } = useEvaluations({
    query,
    status,
    course_id: courseIdNum,
    evaluation_type: "peer",
  });

  // Courses via hook - but we'll build courses from actual evaluations data
  const { courseNameById } = useCourses();
  
  // Build courses list from actual evaluations data (only courses that have evaluations)
  const [coursesFromData, setCoursesFromData] = useState<Array<{id: number, name: string}>>([]);
  
  useEffect(() => {
    if (evaluations.length > 0) {
      const uniqueCourses = new Map<number, {id: number, name: string}>();
      evaluations.forEach(item => {
        if (item.course_id && item.cluster) {
          uniqueCourses.set(item.course_id, {
            id: item.course_id,
            name: item.cluster
          });
        }
      });
      setCoursesFromData(Array.from(uniqueCourses.values()));
    }
  }, [evaluations]);

  // UI state
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Klein UX: als er precies 1 course is en geen filter gezet, preselecteer die
  useEffect(() => {
    if (!courseIdStr && coursesFromData.length === 1) {
      setParams({ course_id: String(coursesFromData[0].id) });
    }
  }, [courseIdStr, coursesFromData, setParams]);

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

  // Group evaluations by course
  const groupedByCourse: Record<string, Evaluation[]> = {};
  evaluations.forEach((item) => {
    const courseKey = item.cluster || "Geen vak";
    if (!groupedByCourse[courseKey]) {
      groupedByCourse[courseKey] = [];
    }
    groupedByCourse[courseKey].push(item);
  });

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Evaluaties</h1>
            <p className="text-sm text-slate-500 mt-1">
              Beheer evaluaties en open het dashboard per evaluatie.
            </p>
          </div>
          <a
            href="/teacher/evaluations/create"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Nieuwe evaluatie
          </a>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* FilterBar */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Left side: search + dropdowns */}
          <div className="flex flex-wrap gap-3 items-center flex-1">
            {/* Search field */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Zoek op titel, vak of team…"
                defaultValue={query}
                onChange={(e) => setParams({ q: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Course dropdown */}
            <select
              className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 min-w-[140px]"
              value={courseIdStr || ""}
              onChange={(e) => setParams({ course_id: e.target.value })}
            >
              <option value="">Alle vakken</option>
              {coursesFromData.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Status dropdown */}
            <select
              className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 min-w-[140px]"
              value={status}
              onChange={(e) => setParams({ status: e.target.value })}
            >
              {STATUSES_FILTER.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label === "All" ? "Alle statussen" : s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} />}

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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-500">
          Geen evaluaties gevonden.
        </div>
      )}

      {!loading &&
        !error &&
        Object.keys(groupedByCourse).map((courseName) => (
          <section key={courseName} className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-800 px-2">
              {courseName}
            </h3>
            <div className="space-y-3">
              {groupedByCourse[courseName].map((e) => {
            const deadlineReview = formatDate(e?.deadlines?.review);
            const deadlineReflection = formatDate(e?.deadlines?.reflection);

            return (
              <div
                key={e.id}
                className="group flex items-stretch justify-between gap-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                {/* Left side: content */}
                <div className="flex flex-1 flex-col gap-1">
                  {/* Title + Status badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-slate-900">
                      {e.title}
                    </h3>
                    {/* Status badge */}
                    {e.status === "open" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-100">
                        Open
                      </span>
                    ) : e.status === "closed" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-100">
                        Gesloten
                      </span>
                    ) : e.status === "published" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-100">
                        Gepubliceerd
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
                        Concept
                      </span>
                    )}
                  </div>

                  {/* Deadlines */}
                  <div className="text-sm text-slate-600 space-y-1">
                    {deadlineReview && (
                      <div>Review deadline: {deadlineReview}</div>
                    )}
                    {deadlineReflection && (
                      <div>Reflectie deadline: {deadlineReflection}</div>
                    )}
                  </div>
                </div>

                {/* Right side: buttons */}
                <div className="flex shrink-0 items-center gap-2">
                  {/* Dashboard button - hidden on small screens */}
                  <Link
                    href={`/teacher/evaluations/${e.id}/dashboard`}
                    className="hidden rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 sm:inline-flex"
                  >
                    Dashboard
                  </Link>

                  {/* Cijfers button */}
                  <Link
                    href={`/teacher/evaluations/${e.id}/grades`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                  >
                    Cijfers
                  </Link>

                  {/* Instellingen button */}
                  <Link
                    href={`/teacher/evaluations/${e.id}/settings`}
                    className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    Instellingen
                  </Link>

                  {/* Delete button - icon only */}
                  <button
                    onClick={() => deleteEvaluation(e.id)}
                    disabled={deletingId === e.id}
                    aria-label="Verwijder evaluatie"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-500 transition hover:border-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingId === e.id ? (
                      <span className="text-xs">...</span>
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
