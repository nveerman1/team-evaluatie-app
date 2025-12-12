"use client";

import { useState, useEffect } from "react";
import { competencyService, courseService } from "@/services";
import type { CompetencyWindow } from "@/dtos";
import { Loading, ErrorMessage, Toast } from "@/components";
import Link from "next/link";

interface Course {
  id: number;
  name: string;
}

export default function CompetenciesPage() {
  const [windows, setWindows] = useState<CompetencyWindow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wins, coursesData] = await Promise.all([
        competencyService.getWindows(),
        courseService.getCourses(),
      ]);
      setWindows(wins);
      setCourses(coursesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Group windows by course
  const groupedWindows = windows.reduce((acc, window) => {
    const courseId = window.course_id || 0; // 0 for uncategorized
    if (!acc[courseId]) {
      acc[courseId] = [];
    }
    acc[courseId].push(window);
    return acc;
  }, {} as Record<number, CompetencyWindow[]>);

  // Filter windows
  const filteredWindows = windows.filter((w) => {
    // Course filter
    if (selectedCourseFilter !== null && w.course_id !== selectedCourseFilter) return false;
    // Status filter
    if (statusFilter && w.status !== statusFilter) return false;
    // Search query
    if (query) {
      const q = query.toLowerCase();
      const hay = `${w.title} ${w.description || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Group filtered windows by course
  const filteredGroupedWindows = filteredWindows.reduce((acc, window) => {
    const courseId = window.course_id || 0;
    if (!acc[courseId]) {
      acc[courseId] = [];
    }
    acc[courseId].push(window);
    return acc;
  }, {} as Record<number, CompetencyWindow[]>);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Competentiemonitor</h1>
            <p className="text-sm text-slate-500 mt-1">
              Beheer competenties en vensters voor competentiescans
            </p>
          </div>
          <Link
            href="/teacher/competencies/windows/create"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Nieuw Venster
          </Link>
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
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Course dropdown */}
              <select
                className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 min-w-[140px]"
                value={selectedCourseFilter ?? ""}
                onChange={(e) =>
                  setSelectedCourseFilter(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">Alle vakken</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>

              {/* Status dropdown */}
              <select
                className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 min-w-[140px]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Alle statussen</option>
                <option value="draft">Concept</option>
                <option value="open">Open</option>
                <option value="closed">Gesloten</option>
              </select>
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast && <Toast message={toast} />}

        {filteredWindows.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-500">
            {query || statusFilter || selectedCourseFilter !== null
              ? "Geen vensters gevonden voor de geselecteerde filters."
              : "Nog geen vensters aangemaakt. Maak je eerste venster aan om te beginnen met competentiescans."}
          </div>
        ) : (
          Object.entries(filteredGroupedWindows).map(([courseId, courseWindows]) => {
            const course = courses.find((c) => c.id === Number(courseId));
            const courseName =
              Number(courseId) === 0
                ? "Geen vak gekoppeld"
                : course?.name || "Onbekend vak";

            return (
              <section key={courseId} className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-800 px-2">
                  {courseName}
                </h3>
                <div className="space-y-3">
                  {courseWindows.map((window) => (
                    <div
                      key={window.id}
                      className="group flex items-stretch justify-between gap-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    >
                      {/* Left side: content */}
                      <div className="flex flex-1 flex-col gap-1">
                        {/* Title + Status badge */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold text-slate-900">{window.title}</h3>
                          {/* Status badge */}
                          {window.status === "open" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-100">
                              Open
                            </span>
                          ) : window.status === "closed" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-100">
                              Gesloten
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
                              Concept
                            </span>
                          )}
                        </div>
                        
                        {/* Details */}
                        <div className="text-sm text-slate-600 space-y-1">
                          {window.description && <div>{window.description}</div>}
                          {window.start_date && window.end_date && (
                            <div>
                              Periode:{" "}
                              {new Date(window.start_date).toLocaleDateString("nl-NL")}{" "}
                              -{" "}
                              {new Date(window.end_date).toLocaleDateString("nl-NL")}
                            </div>
                          )}
                          {window.class_names.length > 0 && (
                            <div>Klassen: {window.class_names.join(", ")}</div>
                          )}
                        </div>
                      </div>

                      {/* Right side: buttons */}
                      <div className="flex shrink-0 items-center gap-2">
                        {/* Dashboard button - hidden on small screens */}
                        <Link
                          href={`/teacher/competencies/windows/${window.id}`}
                          className="hidden rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 sm:inline-flex"
                        >
                          Dashboard
                        </Link>

                        {/* Leerdoelen button */}
                        <Link
                          href={`/teacher/competencies/windows/${window.id}/leerdoelen`}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                        >
                          Leerdoelen
                        </Link>

                        {/* Reflecties button */}
                        <Link
                          href={`/teacher/competencies/windows/${window.id}/reflecties`}
                          className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                        >
                          Reflecties
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </main>
    </>
  );
}
