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
            onClick={() => setActiveTab("trends")}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === "trends"
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
          >
            Trends
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

      {/* Trends Tab */}
      {activeTab === "trends" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Competentietrends</h2>
          </div>

          {/* Filters & Navigation Bar */}
          <div className="p-6 border rounded-xl bg-white space-y-4">
            <h3 className="text-lg font-semibold mb-4">Filters & Weergave</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Class/Team Selector */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Klas/Team
                </label>
                <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Alle klassen</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Competency Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Competentie
                </label>
                <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Alle competenties</option>
                  {competencies.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Period/Windows */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Periode
                </label>
                <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="last3">Laatste 3 vensters</option>
                  <option value="all">Alle vensters</option>
                  <option value="custom">Custom range</option>
                </select>
              </div>

              {/* Display Type */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Weergave
                </label>
                <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="average">Gemiddelde scores</option>
                  <option value="delta">Δ (verschil)</option>
                  <option value="peer_vs_self">Peer vs Zelf</option>
                </select>
              </div>

              {/* Chart Type */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Grafiek type
                </label>
                <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="line">Lijn</option>
                  <option value="radar">Radar</option>
                  <option value="heatmap">Heatmap</option>
                  <option value="cards">Kaarten</option>
                </select>
              </div>

              {/* Compare With */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Vergelijk met
                </label>
                <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="prev">Vorig venster</option>
                  <option value="first">Eerste van schooljaar</option>
                  <option value="custom">Eigen referentie</option>
                </select>
              </div>
            </div>
          </div>

          {/* Class Overview - Competency Sparklines */}
          <div className="p-6 border rounded-xl bg-white space-y-4">
            <h3 className="text-lg font-semibold">Klasoverzicht - Competentieontwikkelingen</h3>
            <p className="text-sm text-gray-600">
              Overzicht van gemiddelde competentiescores over tijd per competentie
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {competencies.slice(0, 6).map((comp) => (
                <div key={comp.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">{comp.name}</h4>
                    <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                      +0.3
                    </span>
                  </div>
                  <div className="h-20 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-xs text-gray-500">Sparkline grafiek (komende)</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Gemiddelde: 3.8, σ=0.5
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Heatmap */}
          <div className="p-6 border rounded-xl bg-white space-y-4">
            <h3 className="text-lg font-semibold">Heatmap - Δ per competentie</h3>
            <p className="text-sm text-gray-600">
              Kleurencodering: Groen = groei, Grijs = stabiel, Rood = achteruitgang
            </p>
            
            <div className="overflow-x-auto">
              <div className="min-w-[600px] p-4 bg-gray-50 rounded">
                <div className="grid grid-cols-7 gap-2">
                  <div className="font-semibold text-sm">Venster</div>
                  {competencies.slice(0, 6).map((comp) => (
                    <div key={comp.id} className="font-semibold text-xs text-center">
                      {comp.name.substring(0, 10)}...
                    </div>
                  ))}
                  
                  {windows.slice(0, 3).map((window) => (
                    <>
                      <div key={window.id} className="text-sm py-2">
                        {window.title}
                      </div>
                      {competencies.slice(0, 6).map((comp) => (
                        <div
                          key={`${window.id}-${comp.id}`}
                          className="bg-green-100 p-2 rounded text-center text-xs"
                        >
                          +0.2
                        </div>
                      ))}
                    </>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Student Trends - Top Climbers/Decliners */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Stijgers */}
            <div className="p-6 border rounded-xl bg-white space-y-4">
              <h3 className="text-lg font-semibold text-green-700">Top 5 Stijgers</h3>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-3 bg-green-50 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">Student {i}</p>
                      <p className="text-xs text-gray-600">Vooral op 'Samenwerken'</p>
                    </div>
                    <span className="text-green-700 font-semibold">+0.{9 - i}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Dalers */}
            <div className="p-6 border rounded-xl bg-white space-y-4">
              <h3 className="text-lg font-semibold text-red-700">Top 5 Dalers</h3>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-3 bg-red-50 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">Student {i}</p>
                      <p className="text-xs text-gray-600">Vooral op 'Plannen'</p>
                    </div>
                    <span className="text-red-700 font-semibold">-0.{i + 2}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Insights Box */}
          <div className="p-6 border-2 border-blue-200 rounded-xl bg-blue-50 space-y-3">
            <h3 className="text-lg font-semibold text-blue-900">
              📊 Automatische Inzichten
            </h3>
            <div className="space-y-2 text-sm text-blue-900">
              <p>
                • Gemiddeld zijn leerlingen in het laatste venster met <strong>+0.5</strong> gegroeid op <strong>Samenwerken</strong>.
              </p>
              <p>
                • De grootste vooruitgang werd geboekt door <strong>groep 3</strong> (+0.8).
              </p>
              <p>
                • Competentie <strong>Plannen & Doorzetten</strong> vertoont een lichte daling (−0.3).
              </p>
              <p>
                • <strong>85%</strong> van de leerlingen laat groei zien in minimaal 3 competenties.
              </p>
            </div>
          </div>

          {/* Individual Trend Graphs - Placeholder */}
          <div className="p-6 border rounded-xl bg-white space-y-4">
            <h3 className="text-lg font-semibold">Individuele Trendgrafieken</h3>
            <p className="text-sm text-gray-600">
              Gebruik de zoekbalk om een specifieke leerling te selecteren en hun individuele trends te bekijken.
            </p>
            <div className="p-8 bg-gray-50 rounded-lg text-center">
              <p className="text-gray-500">
                Selecteer een leerling in de filters hierboven om individuele trends te bekijken
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
