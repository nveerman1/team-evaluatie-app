"use client";

import { useState, useEffect } from "react";
import { competencyService } from "@/services/competency.service";
import type { Competency, CompetencyType, CompetencyListResponse } from "@/dtos";
import { useAuth } from "@/hooks/useAuth";

// View mode type
type ViewMode = "all" | "central" | "teacher" | "shared";

export default function CompetenciesBeheerPage() {
  const { user } = useAuth();
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View mode: show all, only central, only teacher, or only shared
  const [viewMode, setViewMode] = useState<ViewMode>("all");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchCompetencies();
  }, [page, searchQuery, viewMode]);

  async function fetchCompetencies() {
    setLoading(true);
    setError(null);

    try {
      // Build params based on view mode
      const params: {
        page: number;
        limit: number;
        active_only?: boolean;
        competency_type?: CompetencyType | "all";
        include_teacher_competencies?: boolean;
        include_course_competencies?: boolean;
        search?: string;
      } = {
        page,
        limit,
        active_only: true,
        search: searchQuery || undefined,
      };

      if (viewMode === "central") {
        params.competency_type = "central";
      } else if (viewMode === "teacher") {
        params.competency_type = "teacher";
      } else if (viewMode === "shared") {
        params.competency_type = "shared";
      } else {
        // "all" - include all types
        params.competency_type = "all";
        params.include_teacher_competencies = true;
        params.include_course_competencies = true;
      }

      const response: CompetencyListResponse = await competencyService.listTeacherCompetencies(params);

      setCompetencies(response.items);
      setTotal(response.total);
    } catch (err) {
      console.error("Error fetching competencies:", err);
      setError("Er is een fout opgetreden bij het ophalen van de competenties.");
    } finally {
      setLoading(false);
    }
  }

  // Check if user can edit/delete a competency
  function canModify(competency: Competency): boolean {
    // Only the owner of a teacher-specific competency can modify it
    // Central and shared competencies are read-only
    if (competency.is_template) return false;
    if (!user) return false;
    return competency.teacher_id === user.id;
  }

  // Get type badge for competency
  function getTypeBadge(competency: Competency) {
    if (competency.competency_type === "central" || competency.is_template) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
          🏛️ Centraal
        </span>
      );
    } else if (competency.competency_type === "shared") {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-cyan-100 text-cyan-800">
          👥 Gedeeld
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
          👤 Eigen competentie
        </span>
      );
    }
  }

  // Get row background color based on type
  function getRowBackground(competency: Competency): string {
    if (competency.competency_type === "central" || competency.is_template) {
      return "bg-amber-50/30";
    } else if (competency.competency_type === "shared") {
      return "bg-cyan-50/30";
    }
    return "";
  }

  const totalPages = Math.ceil(total / limit);

  if (loading && competencies.length === 0) {
    return (
      <div className="p-8">
        <div className="text-center">Laden...</div>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Competenties Beheer</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Bekijk centrale competenties en beheer je eigen competenties.
            </p>
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
            {/* Placeholder for future create button */}
          </div>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800">
          {error}
        </div>
      )}

      {/* Info banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="text-blue-500 text-xl">ℹ️</span>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Drie soorten competenties:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Centraal</span> — Beheerd door de beheerder, gekoppeld aan rubric-criteria. Alleen-lezen voor docenten.</li>
              <li><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Eigen competentie</span> — Jouw persoonlijke competenties die je zelf kunt aanmaken en bewerken.</li>
              <li><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-800">Gedeeld</span> — Competenties van collega&apos;s die aan hetzelfde vak zijn gekoppeld. Alleen-lezen.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Type Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Toon:</span>
        <button
          onClick={() => setViewMode("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            viewMode === "all"
              ? "bg-sky-100 text-sky-700 border-sky-300"
              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
          }`}
        >
          Alle
        </button>
        <button
          onClick={() => setViewMode("central")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            viewMode === "central"
              ? "bg-amber-100 text-amber-700 border-amber-300"
              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
          }`}
        >
          Centrale competenties
        </button>
        <button
          onClick={() => setViewMode("teacher")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            viewMode === "teacher"
              ? "bg-emerald-100 text-emerald-700 border-emerald-300"
              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
          }`}
        >
          Mijn eigen competenties
        </button>
        <button
          onClick={() => setViewMode("shared")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            viewMode === "shared"
              ? "bg-cyan-100 text-cyan-700 border-cyan-300"
              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
          }`}
        >
          Gedeelde competenties
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-6 bg-white p-4 rounded-2xl border">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Zoeken:</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Naam of beschrijving..."
            className="border rounded-lg px-3 py-2"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Naam
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Beschrijving
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Schaal
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Acties
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {competencies.map((comp) => (
              <tr key={comp.id} className={`hover:bg-gray-50 ${getRowBackground(comp)}`}>
                <td className="px-6 py-4 text-sm">
                  {getTypeBadge(comp)}
                </td>
                <td className="px-6 py-4 text-sm font-medium">{comp.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {comp.description ? (
                    comp.description.length > 80 ? `${comp.description.substring(0, 80)}...` : comp.description
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {comp.scale_min} - {comp.scale_max}
                </td>
                <td className="px-6 py-4 text-sm text-right">
                  {canModify(comp) ? (
                    <>
                      <button
                        className="text-blue-600 hover:text-blue-800 mr-3"
                        onClick={() => {/* TODO: implement edit */}}
                      >
                        Bewerken
                      </button>
                      <button
                        className="text-red-600 hover:text-red-800"
                        onClick={() => {/* TODO: implement delete */}}
                      >
                        Verwijderen
                      </button>
                    </>
                  ) : (
                    <span className="text-gray-400 text-xs italic">Alleen-lezen</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {competencies.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            Geen competenties gevonden
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100"
          >
            Vorige
          </button>
          <span className="px-4 py-2">
            Pagina {page} van {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100"
          >
            Volgende
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm font-medium text-gray-700 mb-2">Legenda:</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">🏛️ Centraal</span>
            <span className="text-gray-600">Beheerd door beheerder (alleen-lezen)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">👤 Eigen</span>
            <span className="text-gray-600">Jouw persoonlijke competenties</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-800">👥 Gedeeld</span>
            <span className="text-gray-600">Van collega&apos;s in hetzelfde vak</span>
          </div>
        </div>
      </div>

      </div>
    </>
  );
}
