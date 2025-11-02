"use client";

import { useState, useEffect } from "react";
import { competencyService } from "@/services";
import type { CompetencyWindow, StudentCompetencyOverview } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";

export default function GrowthPage() {
  const [windows, setWindows] = useState<CompetencyWindow[]>([]);
  const [selectedWindow, setSelectedWindow] = useState<CompetencyWindow | null>(
    null
  );
  const [overview, setOverview] = useState<StudentCompetencyOverview | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWindows();
  }, []);

  useEffect(() => {
    if (selectedWindow) {
      loadOverview(selectedWindow.id);
    }
  }, [selectedWindow]);

  const loadWindows = async () => {
    try {
      setLoading(true);
      const wins = await competencyService.getWindows();
      setWindows(wins);

      // Auto-select the most recent closed window, or the first window
      const closedWindows = wins.filter((w) => w.status === "closed");
      const defaultWindow = closedWindows[0] || wins[0];
      if (defaultWindow) {
        setSelectedWindow(defaultWindow);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load windows");
    } finally {
      setLoading(false);
    }
  };

  const loadOverview = async (windowId: number) => {
    try {
      const data = await competencyService.getMyWindowOverview(windowId);
      setOverview(data);
    } catch (err) {
      console.error("Failed to load overview:", err);
      setError(err instanceof Error ? err.message : "Failed to load overview");
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (windows.length === 0) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="p-8 border rounded-xl bg-gray-50 text-center">
          <p className="text-gray-500">
            Nog geen competentiescans beschikbaar.
          </p>
          <Link
            href="/student"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Terug naar Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Mijn Competentiegroei</h1>
        <p className="text-gray-600">
          Bekijk je ontwikkeling en leerdoelen over tijd
        </p>
      </div>

      {/* Window Selector */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Selecteer periode:
        </label>
        <select
          value={selectedWindow?.id || ""}
          onChange={(e) => {
            const win = windows.find((w) => w.id === Number(e.target.value));
            if (win) setSelectedWindow(win);
          }}
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {windows.map((win) => (
            <option key={win.id} value={win.id}>
              {win.title} ({win.status})
            </option>
          ))}
        </select>
      </div>

      {/* Overview */}
      {overview && (
        <div className="space-y-6">
          {/* Scores */}
          <div className="p-5 border rounded-xl bg-white">
            <h2 className="text-xl font-semibold mb-4">Competentiescores</h2>
            <div className="space-y-3">
              {overview.scores.map((score) => (
                <div
                  key={score.competency_id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <h3 className="font-medium">{score.competency_name}</h3>
                  </div>
                  <div className="flex items-center gap-4">
                    {score.self_score !== null && score.self_score !== undefined && (
                      <div className="text-sm">
                        <span className="text-gray-600">Zelf: </span>
                        <span className="font-semibold">
                          {score.self_score.toFixed(1)}
                        </span>
                      </div>
                    )}
                    {score.final_score !== null && score.final_score !== undefined && (
                      <div className="text-sm">
                        <span className="text-gray-600">Totaal: </span>
                        <span className="font-semibold text-blue-600">
                          {score.final_score.toFixed(1)}
                        </span>
                      </div>
                    )}
                    {score.delta !== null && score.delta !== undefined && (
                      <div
                        className={`text-sm font-semibold ${
                          score.delta > 0
                            ? "text-green-600"
                            : score.delta < 0
                            ? "text-red-600"
                            : "text-gray-600"
                        }`}
                      >
                        {score.delta > 0 ? "+" : ""}
                        {score.delta.toFixed(1)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Goals */}
          {overview.goals.length > 0 && (
            <div className="p-5 border rounded-xl bg-white">
              <h2 className="text-xl font-semibold mb-4">Leerdoelen</h2>
              <div className="space-y-3">
                {overview.goals.map((goal) => (
                  <div
                    key={goal.id}
                    className="p-4 bg-purple-50 border border-purple-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium">{goal.goal_text}</h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          goal.status === "achieved"
                            ? "bg-green-100 text-green-700"
                            : goal.status === "not_achieved"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {goal.status === "achieved"
                          ? "Behaald"
                          : goal.status === "not_achieved"
                          ? "Niet behaald"
                          : "Bezig"}
                      </span>
                    </div>
                    {goal.success_criteria && (
                      <p className="text-sm text-gray-600">
                        Succescriterium: {goal.success_criteria}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reflection */}
          {overview.reflection && (
            <div className="p-5 border rounded-xl bg-white">
              <h2 className="text-xl font-semibold mb-4">Reflectie</h2>
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {overview.reflection.text}
                </p>
                {overview.reflection.goal_achieved !== null && (
                  <div className="mt-3 text-sm">
                    <span className="text-gray-600">Doel behaald: </span>
                    <span
                      className={`font-semibold ${
                        overview.reflection.goal_achieved
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {overview.reflection.goal_achieved ? "Ja" : "Nee"}
                    </span>
                  </div>
                )}
                {overview.reflection.evidence && (
                  <div className="mt-3 text-sm">
                    <span className="text-gray-600">Bewijs: </span>
                    <span className="text-gray-700">
                      {overview.reflection.evidence}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Back Button */}
      <div>
        <Link
          href="/student"
          className="inline-block px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          ← Terug naar Dashboard
        </Link>
      </div>
    </main>
  );
}
