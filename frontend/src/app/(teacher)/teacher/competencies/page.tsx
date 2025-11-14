"use client";

import { useState, useEffect } from "react";
import { competencyService, courseService } from "@/services";
import type { Competency, CompetencyWindow } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";

interface Course {
  id: number;
  name: string;
}

export default function CompetenciesPage() {
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [windows, setWindows] = useState<CompetencyWindow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"windows" | "trends">(
    "windows"
  );
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<number | null>(null);
  
  // Trends filter state
  const [trendsClassFilter, setTrendsClassFilter] = useState<number | null>(null);
  const [trendsCompetencyFilter, setTrendsCompetencyFilter] = useState<number | null>(null);
  const [trendsPeriod, setTrendsPeriod] = useState<string>("last3");
  const [trendsDisplayType, setTrendsDisplayType] = useState<string>("average");
  const [trendsChartType, setTrendsChartType] = useState<string>("line");
  const [trendsCompareWith, setTrendsCompareWith] = useState<string>("prev");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [comps, wins, coursesData] = await Promise.all([
        competencyService.getCompetencies(false),
        competencyService.getWindows(),
        courseService.getCourses(),
      ]);
      setCompetencies(comps);
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

  // Filter windows if a course is selected
  const filteredWindows = selectedCourseFilter !== null
    ? windows.filter(w => w.course_id === selectedCourseFilter)
    : windows;

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <input
            type="text"
            placeholder="Zoek op titel, vak..."
            value=""
            onChange={() => {}}
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
            value=""
            onChange={() => {}}
            className="px-3 py-2 rounded-lg border"
          >
            <option value="">Alle statussen</option>
            <option value="open">Open</option>
            <option value="closed">Gesloten</option>
          </select>
          {selectedCourseFilter !== null && (
            <button
              onClick={() => setSelectedCourseFilter(null)}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50"
            >
              Reset
            </button>
          )}
        </div>

        {filteredWindows.length === 0 ? (
            <div className="p-8 border rounded-xl bg-gray-50 text-center">
              <p className="text-gray-500">
                {selectedCourseFilter !== null
                  ? "Geen vensters gevonden voor dit vak."
                  : "Nog geen vensters aangemaakt. Maak je eerste venster aan om te beginnen met competentiescans."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Group by course */}
              {Object.entries(groupedWindows)
                .filter(([courseId]) =>
                  selectedCourseFilter === null
                    ? true
                    : Number(courseId) === selectedCourseFilter
                )
                .map(([courseId, courseWindows]) => {
                  const course = courses.find((c) => c.id === Number(courseId));
                  const courseName =
                    Number(courseId) === 0
                      ? "Geen vak gekoppeld"
                      : course?.name || "Onbekend vak";

                  return (
                    <div key={courseId} className="space-y-3">
                      <h3 className="text-lg font-semibold text-gray-800 px-2">
                        {courseName}
                      </h3>
                      <div className="grid gap-4">
                        {courseWindows.map((window) => (
                <Link
                  key={window.id}
                  href={`/teacher/competencies/windows/${window.id}`}
                  className="block p-5 border rounded-xl bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">
                        {window.title}
                      </h3>
                      <div className="space-y-1 text-sm text-gray-600">
                        {window.description && <p>{window.description}</p>}
                        {window.start_date && window.end_date && (
                          <p>
                            Periode:{" "}
                            {new Date(window.start_date).toLocaleDateString(
                              "nl-NL"
                            )}{" "}
                            -{" "}
                            {new Date(window.end_date).toLocaleDateString(
                              "nl-NL"
                            )}
                          </p>
                        )}
                        {window.class_names.length > 0 && (
                          <p>Klassen: {window.class_names.join(", ")}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          window.status === "open"
                            ? "bg-green-100 text-green-700"
                            : window.status === "closed"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {window.status === "open"
                          ? "Open"
                          : window.status === "closed"
                          ? "Gesloten"
                          : "Concept"}
                      </span>
                      <span className="text-gray-400">→</span>
                    </div>
                  </div>
                </Link>
              ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
      </div>
    </>
  );
}
