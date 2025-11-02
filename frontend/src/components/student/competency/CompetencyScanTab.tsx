"use client";

import { useState, useEffect } from "react";
import { competencyService } from "@/services";
import type { CompetencyWindow, Competency, CompetencySelfScore } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";

export function CompetencyScanTab() {
  const [windows, setWindows] = useState<CompetencyWindow[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wins, comps] = await Promise.all([
        competencyService.getWindows("open"),
        competencyService.getCompetencies(true),
      ]);
      setWindows(wins);
      setCompetencies(comps);
    } catch (err) {
      console.error("Failed to load competency data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 border rounded-xl bg-gray-50">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border rounded-xl bg-gray-50">
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Open Windows */}
      {windows.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Open Scans</h3>
          {windows.map((window) => (
            <div
              key={window.id}
              className="p-5 border rounded-xl bg-white shadow-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h4 className="text-lg font-semibold mb-2">{window.title}</h4>
                  {window.description && (
                    <p className="text-sm text-gray-600 mb-2">
                      {window.description}
                    </p>
                  )}
                  {window.end_date && (
                    <p className="text-sm text-gray-500">
                      Sluit op:{" "}
                      {new Date(window.end_date).toLocaleDateString("nl-NL")}
                    </p>
                  )}
                </div>
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                  Open
                </span>
              </div>

              <div className="flex gap-3">
                {window.require_self_score && (
                  <Link
                    href={`/student/competency/scan/${window.id}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Scan Invullen
                  </Link>
                )}
                {window.require_goal && (
                  <Link
                    href={`/student/competency/goal/${window.id}`}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                  >
                    Leerdoel Instellen
                  </Link>
                )}
                {window.require_reflection && (
                  <Link
                    href={`/student/competency/reflection/${window.id}`}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                  >
                    Reflectie Schrijven
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 border rounded-xl bg-gray-50 text-center">
          <p className="text-gray-500">
            Geen open competentiescans op dit moment.
          </p>
        </div>
      )}

      {/* My Growth Link */}
      <div className="p-5 border rounded-xl bg-blue-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">Mijn Groei</h3>
            <p className="text-sm text-gray-600">
              Bekijk je competentieontwikkeling en leerdoelen
            </p>
          </div>
          <Link
            href="/student/competency/growth"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Bekijk Groei →
          </Link>
        </div>
      </div>

      {/* Info Section */}
      {competencies.length > 0 && (
        <div className="p-5 border rounded-xl bg-gray-50">
          <h3 className="text-sm font-semibold mb-3 text-gray-700">
            Competenties die worden gevolgd:
          </h3>
          <div className="flex flex-wrap gap-2">
            {competencies.map((comp) => (
              <span
                key={comp.id}
                className="px-3 py-1 rounded-full bg-white text-gray-700 text-sm border"
              >
                {comp.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
