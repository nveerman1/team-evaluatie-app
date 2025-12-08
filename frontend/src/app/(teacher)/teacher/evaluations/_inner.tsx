"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUrlState, useEvaluations, useCourses } from "@/hooks";
import type { Evaluation } from "@/dtos/evaluation.dto";
import { Loading, ErrorMessage, Toast, StatusBadge } from "@/components";
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

  // Courses via hook
  const { courses, courseNameById } = useCourses();

  // UI state
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Klein UX: als er precies 1 course is en geen filter gezet, preselecteer die
  useEffect(() => {
    if (!courseIdStr && courses.length === 1) {
      setParams({ course_id: String(courses[0].id) });
    }
  }, [courseIdStr, courses, setParams]);

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
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Evaluaties</h1>
            <p className="text-gray-600 mt-1 text-sm">
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

      {/* Filters */}
      <section className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
        <input
          type="text"
          placeholder="Zoek op titel, vak..."
          defaultValue={query}
          onChange={(e) => setParams({ q: e.target.value })}
          className="px-3 py-2 rounded-lg border w-64"
        />
        <select
          value={courseIdStr || ""}
          onChange={(e) => setParams({ course_id: e.target.value })}
          className="px-3 py-2 rounded-lg border"
        >
          <option value="">Alle vakken</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setParams({ status: e.target.value })}
          className="px-3 py-2 rounded-lg border"
        >
          {STATUSES_FILTER.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label === "All" ? "Alle statussen" : s.label}
            </option>
          ))}
        </select>

        {(query || status || courseIdStr) && (
          <button
            onClick={() => setParams({ q: "", status: "", course_id: "" })}
            className="px-3 py-2 rounded-lg border hover:bg-gray-50"
          >
            Reset
          </button>
        )}
      </section>

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
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 text-gray-500">
          Geen evaluaties gevonden.
        </div>
      )}

      {!loading &&
        !error &&
        Object.keys(groupedByCourse).map((courseName) => (
          <section key={courseName} className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-800 px-2">
              {courseName}
            </h3>
            <div className="space-y-3">
              {groupedByCourse[courseName].map((e) => {
            const deadlineReview = formatDate(e?.deadlines?.review);
            const deadlineReflection = formatDate(e?.deadlines?.reflection);

            return (
              <div
                key={e.id}
                className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-gray-900">{e.title}</h4>
                      {/* Status badge */}
                      <StatusBadge status={e.status} />
                    </div>
                    
                    {/* Deadlines */}
                    <div className="text-sm text-gray-600 space-y-1">
                      {deadlineReview && (
                        <div>Review deadline: {deadlineReview}</div>
                      )}
                      {deadlineReflection && (
                        <div>Reflectie deadline: {deadlineReflection}</div>
                      )}
                    </div>
                  </div>

                  {/* Acties */}
                  <div className="flex gap-2 shrink-0">
                    <Link
                      href={`/teacher/evaluations/${e.id}/dashboard`}
                      className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href={`/teacher/evaluations/${e.id}/grades`}
                      className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50"
                    >
                      Cijfers
                    </Link>
                    <Link
                      href={`/teacher/evaluations/${e.id}/settings`}
                      className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50"
                    >
                      Instellingen
                    </Link>
                    <button
                      onClick={() => deleteEvaluation(e.id)}
                      disabled={deletingId === e.id}
                      className="px-3 py-1.5 text-sm rounded-lg border hover:bg-red-50 hover:text-red-600 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Verwijder evaluatie"
                    >
                      {deletingId === e.id ? "..." : "Verwijderen"}
                    </button>
                  </div>
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
