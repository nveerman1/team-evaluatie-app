"use client";

import { useState, useEffect, useMemo } from "react";
import { competencyService } from "@/services/competency.service";
import type { Competency, CompetencyType, CompetencyListResponse, CompetencyCategory, CompetencyCreate } from "@/dtos";
import { useAuth } from "@/hooks/useAuth";

// View mode type
type ViewMode = "all" | "central" | "teacher" | "shared";

export default function CompetenciesBeheerPage() {
  const { user } = useAuth();
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [categories, setCategories] = useState<CompetencyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View mode: show all, only central, only teacher, or only shared
  const [viewMode, setViewMode] = useState<ViewMode>("all");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState<CompetencyCreate>({
    name: "",
    description: "",
    category_id: undefined,
    phase: "",
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchCompetencies();
  }, [page, searchQuery, viewMode, categoryFilter, phaseFilter]);

  async function fetchCategories() {
    try {
      const cats = await competencyService.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  }

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
        category_id?: number;
        phase?: string;
        search?: string;
      } = {
        page,
        limit,
        active_only: true,
        search: searchQuery || undefined,
        category_id: categoryFilter !== "all" ? categoryFilter : undefined,
        phase: phaseFilter || undefined,
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
          👤 Eigen
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

  async function handleCreate() {
    if (!formData.name) {
      alert("Naam is verplicht");
      return;
    }

    try {
      await competencyService.createCompetency({
        ...formData,
        is_template: false, // Teacher competencies are not templates
      });
      setIsCreateModalOpen(false);
      setFormData({ name: "", description: "", category_id: undefined, phase: "" });
      fetchCompetencies();
    } catch (err) {
      console.error("Error creating competency:", err);
      alert("Er is een fout opgetreden bij het aanmaken van de competentie.");
    }
  }

  async function handleDelete(competency: Competency) {
    if (!canModify(competency)) {
      alert("Je kunt deze competentie niet verwijderen.");
      return;
    }

    if (!confirm("Weet je zeker dat je deze competentie wilt verwijderen?")) {
      return;
    }

    try {
      await competencyService.deleteCompetency(competency.id);
      fetchCompetencies();
    } catch (err) {
      console.error("Error deleting competency:", err);
      alert("Er is een fout opgetreden bij het verwijderen van de competentie.");
    }
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
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              + Eigen Competentie
            </button>
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

      {/* Phase Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8" aria-label="Tabs">
          <button
            onClick={() => setPhaseFilter("")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                phaseFilter === ""
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            Alle fasen
          </button>
          <button
            onClick={() => setPhaseFilter("onderbouw")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                phaseFilter === "onderbouw"
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            Onderbouw
          </button>
          <button
            onClick={() => setPhaseFilter("bovenbouw")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                phaseFilter === "bovenbouw"
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            Bovenbouw
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-6 bg-white p-4 rounded-2xl border">
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
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Categorie:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value === "all" ? "all" : parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2"
          >
            <option value="all">Alle categorieën</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
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
                Categorie
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Naam
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Beschrijving
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Fase
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
                <td className="px-6 py-4 text-sm">
                  {comp.category_name ? (
                    <div>
                      <span className="font-medium">{comp.category_name}</span>
                      {comp.category_description && (
                        <p className="text-xs text-gray-500 mt-0.5">{comp.category_description}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm font-medium">{comp.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {comp.description ? (
                    comp.description.length > 60 ? `${comp.description.substring(0, 60)}...` : comp.description
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  {comp.phase ? (
                    <span className={`px-2 py-1 rounded text-xs ${
                      comp.phase === "onderbouw" 
                        ? "bg-blue-100 text-blue-800" 
                        : "bg-purple-100 text-purple-800"
                    }`}>
                      {comp.phase === "onderbouw" ? "Onderbouw" : "Bovenbouw"}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
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
                        onClick={() => handleDelete(comp)}
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

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-2">Nieuwe Eigen Competentie</h2>
            <p className="text-sm text-gray-600 mb-4">
              Deze competentie wordt als persoonlijke competentie opgeslagen en is alleen voor jou zichtbaar.
            </p>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                  👤 Eigen competentie
                </span>
                <span className="text-xs text-emerald-700">Deze competentie kun je later bewerken en verwijderen.</span>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Naam *
                </label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="bijv. Samenwerken"
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Categorie
                </label>
                <select
                  value={formData.category_id || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, category_id: e.target.value ? parseInt(e.target.value) : undefined })
                  }
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">Geen categorie</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Beschrijving
                </label>
                <textarea
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Beschrijf wat deze competentie inhoudt..."
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fase</label>
                <select
                  value={formData.phase || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, phase: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">Niet gespecificeerd</option>
                  <option value="onderbouw">Onderbouw</option>
                  <option value="bovenbouw">Bovenbouw</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              >
                Aanmaken
              </button>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
