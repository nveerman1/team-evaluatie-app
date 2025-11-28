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
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Competentiemonitor</h1>
            <p className="text-gray-600 mt-1 text-sm">
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

        {/* Filters */}
        <section className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <input
            type="text"
            placeholder="Zoek op titel, vak..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="px-3 py-2 rounded-lg border w-64"
          />
          <select
            value={selectedCourseFilter ?? ""}
            onChange={(e) =>
              setSelectedCourseFilter(
                e.target.value ? Number(e.target.value) : null
              )
            }
            className="px-3 py-2 rounded-lg border"
          >
            <option value="">Alle vakken</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border"
          >
            <option value="">Alle statussen</option>
            <option value="draft">Concept</option>
            <option value="open">Open</option>
            <option value="closed">Gesloten</option>
          </select>
          {(selectedCourseFilter !== null || statusFilter || query) && (
            <button
              onClick={() => {
                setSelectedCourseFilter(null);
                setStatusFilter("");
                setQuery("");
              }}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50"
            >
              Reset
            </button>
          )}
        </section>

        {/* Toast */}
        {toast && <Toast message={toast} />}

        {filteredWindows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 text-gray-500">
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
                <h3 className="text-lg font-semibold text-gray-800 px-2">
                  {courseName}
                </h3>
                <div className="space-y-3">
                  {courseWindows.map((window) => (
                    <div
                      key={window.id}
                      className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-gray-900">{window.title}</h4>
                            {/* Status badge */}
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ring-1 ${
                                window.status === "open"
                                  ? "ring-green-200 bg-green-50 text-green-700"
                                  : window.status === "closed"
                                  ? "ring-gray-200 bg-gray-50 text-gray-700"
                                  : "ring-yellow-200 bg-yellow-50 text-yellow-700"
                              }`}
                            >
                              {window.status === "open"
                                ? "Open"
                                : window.status === "closed"
                                ? "Gesloten"
                                : "Concept"}
                            </span>
                          </div>
                          
                          {/* Details */}
                          <div className="text-sm text-gray-600 space-y-1">
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

                        {/* Acties */}
                        <div className="flex gap-2 shrink-0">
                          <Link
                            href={`/teacher/competencies/windows/${window.id}`}
                            className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50"
                          >
                            Dashboard
                          </Link>
                          <Link
                            href={`/teacher/competencies/windows/${window.id}/leerdoelen`}
                            className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50"
                          >
                            Leerdoelen
                          </Link>
                          <Link
                            href={`/teacher/competencies/windows/${window.id}/reflecties`}
                            className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50"
                          >
                            Reflecties
                          </Link>
                        </div>
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
