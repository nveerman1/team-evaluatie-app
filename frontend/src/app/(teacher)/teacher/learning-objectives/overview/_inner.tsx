"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getLearningObjectivesOverview,
  listLearningObjectives,
} from "@/services/learning-objective.service";
import type {
  LearningObjectiveOverviewResponse,
  LearningObjectiveDto,
} from "@/dtos/learning-objective.dto";

export default function LearningObjectivesOverviewInner() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>("");
  const [overview, setOverview] = useState<LearningObjectiveOverviewResponse | null>(
    null
  );
  const [allObjectives, setAllObjectives] = useState<LearningObjectiveDto[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [className, setClassName] = useState<string>("");
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<
    number | undefined
  >(undefined);

  useEffect(() => {
    const email = localStorage.getItem("userEmail");
    if (!email) {
      router.push("/");
      return;
    }
    setUserEmail(email);
  }, [router]);

  useEffect(() => {
    if (userEmail) {
      fetchObjectives();
    }
  }, [userEmail]);

  useEffect(() => {
    if (userEmail) {
      fetchOverview();
    }
  }, [userEmail, className, selectedObjectiveId]);

  async function fetchObjectives() {
    if (!userEmail) return;

    try {
      const response = await listLearningObjectives(userEmail, {
        active: true,
        limit: 100,
      });
      setAllObjectives(response.items);
    } catch (err) {
      console.error("Error fetching objectives:", err);
    }
  }

  async function fetchOverview() {
    if (!userEmail) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getLearningObjectivesOverview(userEmail, {
        class_name: className || undefined,
        learning_objective_id: selectedObjectiveId,
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
  }

  function getScoreColor(score: number | null): string {
    if (score === null) return "bg-gray-100";
    if (score >= 4.5) return "bg-green-500 text-white";
    if (score >= 3.5) return "bg-green-300";
    if (score >= 2.5) return "bg-yellow-300";
    if (score >= 1.5) return "bg-orange-300";
    return "bg-red-300";
  }

  function formatScore(score: number | null): string {
    if (score === null) return "-";
    return score.toFixed(1);
  }

  if (loading && !overview) {
    return (
      <div className="p-8">
        <div className="text-center">Laden...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-full mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Leerdoelen Overzicht</h1>
        <p className="text-gray-600">
          Volg de voortgang van leerlingen op leerdoelen gebaseerd op
          beoordelingen.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
        <div>
          <label className="block text-sm font-medium mb-1">Klas</label>
          <input
            type="text"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="4A, 5B, etc."
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Filter op Leerdoel
          </label>
          <select
            value={selectedObjectiveId || ""}
            onChange={(e) =>
              setSelectedObjectiveId(
                e.target.value ? Number(e.target.value) : undefined
              )
            }
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">Alle leerdoelen</option>
            {allObjectives.map((obj) => (
              <option key={obj.id} value={obj.id}>
                {obj.domain ? `${obj.domain} - ` : ""}
                {obj.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Overview Table */}
      {overview && (
        <div className="bg-white rounded-lg shadow overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">
                  Leerling
                </th>
                {overview.students.length > 0 &&
                  overview.students[0].objectives.map((obj) => (
                    <th
                      key={obj.learning_objective_id}
                      className="px-4 py-3 text-center font-medium text-gray-500 uppercase"
                      title={obj.learning_objective_title}
                    >
                      <div className="max-w-32 truncate">
                        {obj.domain ? `${obj.domain} - ` : ""}
                        {obj.learning_objective_title}
                      </div>
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {overview.students.map((student) => (
                <tr key={student.user_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium sticky left-0 bg-white">
                    <div>
                      {student.user_name}
                      {student.class_name && (
                        <span className="text-xs text-gray-500 block">
                          {student.class_name}
                        </span>
                      )}
                    </div>
                  </td>
                  {student.objectives.map((obj) => (
                    <td
                      key={obj.learning_objective_id}
                      className="px-4 py-3 text-center"
                    >
                      <div
                        className={`inline-block px-3 py-1 rounded ${getScoreColor(
                          obj.average_score
                        )}`}
                        title={`${obj.assessment_count} beoordelingen`}
                      >
                        {formatScore(obj.average_score)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {overview.students.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Geen gegevens gevonden voor de geselecteerde filters
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 p-4 bg-gray-50 rounded">
        <h3 className="font-medium mb-2">Legenda:</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded"></div>
            <span>Uitstekend (≥4.5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-300 rounded"></div>
            <span>Goed (≥3.5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-300 rounded"></div>
            <span>Voldoende (≥2.5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-300 rounded"></div>
            <span>Onvoldoende (≥1.5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-300 rounded"></div>
            <span>Slecht (&lt;1.5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-100 rounded"></div>
            <span>Geen data</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-600">
          Scores zijn gemiddelden van alle gekoppelde beoordelingen (peer
          evaluaties en projectbeoordelingen).
        </p>
      </div>

      {/* Export button placeholder */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={() => alert("CSV export nog niet geïmplementeerd")}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Exporteer naar CSV
        </button>
      </div>
    </div>
  );
}
