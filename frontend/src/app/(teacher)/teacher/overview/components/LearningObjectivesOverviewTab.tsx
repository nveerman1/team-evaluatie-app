"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getLearningObjectivesOverview,
  listLearningObjectives,
} from "@/services/learning-objective.service";
import { courseService } from "@/services/course.service";
import api from "@/lib/api";
import type {
  LearningObjectiveOverviewResponse,
  LearningObjectiveDto,
} from "@/dtos/learning-objective.dto";
import type { CourseLite } from "@/dtos/course.dto";

type AggregationType = "average" | "most_recent" | "highest";
type Phase = "onderbouw" | "bovenbouw";

export default function LearningObjectivesOverviewTab() {
  const [overview, setOverview] = useState<LearningObjectiveOverviewResponse | null>(
    null
  );
  const [allObjectives, setAllObjectives] = useState<LearningObjectiveDto[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase toggle
  const [phase, setPhase] = useState<Phase>("onderbouw");

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [courseFilter, setCourseFilter] = useState<number | undefined>(undefined);
  const [classFilter, setClassFilter] = useState<string>("");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [aggregationType, setAggregationType] = useState<AggregationType>("average");

  // Dropdown data
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [classes, setClasses] = useState<string[]>([]);

  const fetchCourses = useCallback(async () => {
    try {
      const coursesData = await courseService.getCourses();
      setCourses(coursesData);
    } catch (err) {
      console.error("Error fetching courses:", err);
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    try {
      // Fetch all students to get unique class names (max limit is 500)
      const response = await api.get<Array<{ class_name: string | null }>>("/students", {
        params: { limit: 500 }
      });
      const uniqueClasses = Array.from(
        new Set(
          response.data
            .map((s) => s.class_name)
            .filter((c): c is string => !!c)
        )
      ).sort();
      setClasses(uniqueClasses);
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
  }, []);

  const fetchObjectives = useCallback(async () => {
    try {
      const response = await listLearningObjectives({
        phase: phase,
        limit: 100,
      });
      setAllObjectives(response.items);
    } catch (err) {
      console.error("Error fetching objectives:", err);
    }
  }, [phase]);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getLearningObjectivesOverview({
        class_name: classFilter || undefined,
        course_id: courseFilter,
      });

      setOverview(response);
    } catch (err) {
      console.error("Error fetching overview:", err);
      setError(
        "Er is een fout opgetreden bij het ophalen van het overzicht."
      );
    } finally {
      setLoading(false);
    }
  }, [classFilter, courseFilter]);

  useEffect(() => {
    fetchCourses();
    fetchClasses();
  }, [fetchCourses, fetchClasses]);

  useEffect(() => {
    fetchObjectives();
  }, [fetchObjectives]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  function getScoreColor(score: number | null): string {
    if (score === null) return "bg-gray-100 text-gray-400";
    if (score >= 4) return "bg-green-500 text-white";
    if (score >= 3) return "bg-yellow-300 text-gray-900";
    return "bg-red-300 text-gray-900";
  }

  function formatScore(score: number | null): string {
    if (score === null) return "-";
    return score.toFixed(1);
  }

  function calculateAverage(objectives: Array<{ average_score: number | null }>): number | null {
    const scores = objectives
      .map(obj => obj.average_score)
      .filter((s): s is number => s !== null);
    
    if (scores.length === 0) return null;
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
  }

  function handleExportCSV() {
    if (!overview) return;

    // Create CSV content
    const headers = ["Naam", "Klas", ...allObjectives.map(obj => obj.domain || obj.title)];
    const rows = overview.students.map(student => {
      const scores = allObjectives.map(obj => {
        const progress = student.objectives.find(
          o => o.learning_objective_id === obj.id
        );
        return formatScore(progress?.average_score || null);
      });
      return [
        student.user_name,
        student.class_name || "",
        ...scores
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // Download
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leerdoelen-overzicht-${phase}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Filter students by search query
  const filteredStudents = overview?.students.filter(student => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return student.user_name.toLowerCase().includes(query) ||
             student.class_name?.toLowerCase().includes(query);
    }
    return true;
  }) || [];

  if (loading && !overview) {
    return (
      <div className="p-8">
        <div className="text-center">Laden...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">Leerdoelen / Eindtermen Overzicht</h2>
          <p className="text-gray-600">
            Totaaloverzicht van hoe goed leerlingen de leerdoelen/eindtermen beheersen
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
        >
          📤 Exporteer CSV
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
          {error}
        </div>
      )}

      {/* Phase Toggle */}
      <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
        <button
          onClick={() => setPhase("onderbouw")}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            phase === "onderbouw"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          Onderbouw
        </button>
        <button
          onClick={() => setPhase("bovenbouw")}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            phase === "bovenbouw"
              ? "bg-purple-600 text-white shadow-md"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          Bovenbouw
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">🔍 Zoeken</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Naam leerling"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">🧭 Vak / Course</label>
            <select
              value={courseFilter || ""}
              onChange={(e) => setCourseFilter(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Alle vakken</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">🏫 Klas</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Alle klassen</option>
              {classes.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">📅 Periode</label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="all">Alle data</option>
              <option value="4weeks">Laatste 4 weken</option>
              <option value="quarter">Dit kwartaal</option>
              <option value="year">Dit schooljaar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Overview Table */}
      {overview && (
        <div className="bg-white rounded-lg shadow border">
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 uppercase text-xs sticky left-0 bg-gray-50 z-20 border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)] whitespace-nowrap min-w-[150px]">
                    Naam
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 uppercase text-xs sticky left-[150px] bg-gray-50 z-20 border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)] whitespace-nowrap min-w-[100px]">
                    Klas
                  </th>
                  {allObjectives.map((obj) => (
                    <th
                      key={obj.id}
                      className="px-4 py-3 text-center font-medium text-gray-700 uppercase text-xs whitespace-nowrap min-w-[100px]"
                      title={`${obj.title}\n${obj.description || ""}`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold">{obj.domain}</span>
                        {obj.order > 0 && (
                          <span className="text-xs text-gray-500">{obj.order}</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredStudents.map((student) => (
                    <tr key={student.user_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium sticky left-0 bg-white hover:bg-gray-50 z-10 border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)] whitespace-nowrap">
                        {student.user_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 sticky left-[150px] bg-white hover:bg-gray-50 z-10 border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)] whitespace-nowrap">
                        {student.class_name || "-"}
                      </td>
                      {allObjectives.map((obj) => {
                        const progress = student.objectives.find(
                          o => o.learning_objective_id === obj.id
                        );
                        return (
                          <td
                            key={obj.id}
                            className="px-4 py-3 text-center whitespace-nowrap"
                          >
                            <div
                              className={`inline-flex items-center justify-center px-3 py-1.5 rounded font-medium min-w-[50px] ${getScoreColor(
                                progress?.average_score || null
                              )}`}
                              title={`${progress?.assessment_count || 0} beoordelingen`}
                            >
                              {formatScore(progress?.average_score || null)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )
                )}
              </tbody>
            </table>

            {filteredStudents.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Geen gegevens gevonden voor de geselecteerde filters
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-3">Legenda:</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-10 h-8 bg-green-500 rounded flex items-center justify-center text-white font-medium">
              4+
            </div>
            <span>Goed (≥4.0)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-8 bg-yellow-300 rounded flex items-center justify-center font-medium">
              3+
            </div>
            <span>Voldoende (≥3.0)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-8 bg-red-300 rounded flex items-center justify-center font-medium">
              &lt;3
            </div>
            <span>Onvoldoende (&lt;3.0)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-400">
              -
            </div>
            <span>Geen data</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-600">
          Scores zijn gemiddelden van alle gekoppelde beoordelingen 
          (peer evaluaties, projectbeoordelingen en competentiescans).
        </p>
      </div>
    </div>
  );
}
