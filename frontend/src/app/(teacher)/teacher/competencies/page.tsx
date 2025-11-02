"use client";

import { useState, useEffect } from "react";
import { competencyService, courseService } from "@/services";
import type { Competency, CompetencyWindow } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";

export default function CompetenciesPage() {
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [windows, setWindows] = useState<CompetencyWindow[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"competencies" | "windows">(
    "windows"
  );
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<number | null>(null);

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Competentiemonitor</h1>
        <p className="text-gray-600">
          Beheer competenties en vensters voor competentiescans
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab("windows")}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === "windows"
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
          >
            Vensters
          </button>
          <button
            onClick={() => setActiveTab("competencies")}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === "competencies"
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
          >
            Competenties
          </button>
        </div>
      </div>

      {/* Windows Tab */}
      {activeTab === "windows" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Competentievensters</h2>
            <Link
              href="/teacher/competencies/windows/create"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Nieuw Venster
            </Link>
          </div>

          {/* Course Filter */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Filter op vak:</label>
            <select
              value={selectedCourseFilter ?? ""}
              onChange={(e) =>
                setSelectedCourseFilter(
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Alle vakken</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
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
                      <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">
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
      )}

      {/* Competencies Tab */}
      {activeTab === "competencies" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Competenties</h2>
            <Link
              href="/teacher/competencies/create"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Nieuwe Competentie
            </Link>
          </div>

          {competencies.length === 0 ? (
            <div className="p-8 border rounded-xl bg-gray-50 text-center">
              <p className="text-gray-500">
                Nog geen competenties aangemaakt. Maak je eerste competentie
                aan om te beginnen.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {competencies
                .sort((a, b) => a.order - b.order)
                .map((comp) => (
                  <Link
                    key={comp.id}
                    href={`/teacher/competencies/${comp.id}`}
                    className="block p-4 border rounded-lg bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">{comp.name}</h3>
                          {!comp.active && (
                            <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs">
                              Inactief
                            </span>
                          )}
                          {comp.category && (
                            <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs">
                              {comp.category}
                            </span>
                          )}
                        </div>
                        {comp.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {comp.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Schaal: {comp.scale_min} - {comp.scale_max}
                        </p>
                      </div>
                      <span className="text-gray-400">→</span>
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
