"use client";

import { useState, useEffect } from "react";
import {
  listLearningObjectives,
  createLearningObjective,
  updateLearningObjective,
  deleteLearningObjective,
  importLearningObjectives,
} from "@/services/learning-objective.service";
import type {
  LearningObjectiveDto,
  LearningObjectiveCreateDto,
  LearningObjectiveUpdateDto,
  LearningObjectiveImportItem,
} from "@/dtos/learning-objective.dto";
import { useAuth } from "@/hooks/useAuth";

// View mode type
type ViewMode = "all" | "template" | "teacher";

export default function LearningObjectivesInner() {
  const { user } = useAuth();
  const [objectives, setObjectives] = useState<LearningObjectiveDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View mode: show all, only templates (central), or only teacher objectives
  const [viewMode, setViewMode] = useState<ViewMode>("all");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [phaseFilter, setPhaseFilter] = useState<string>("");  // "onderbouw" | "bovenbouw" | ""

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [currentObjective, setCurrentObjective] =
    useState<LearningObjectiveDto | null>(null);

  // Form state
  const [formData, setFormData] = useState<
    LearningObjectiveCreateDto | LearningObjectiveUpdateDto
  >({
    domain: "",
    title: "",
    description: "",
    order: 0,
    phase: "",
  });

  // Import state
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    fetchObjectives();
  }, [page, searchQuery, domainFilter, phaseFilter, viewMode]);

  async function fetchObjectives() {
    setLoading(true);
    setError(null);

    try {
      // Determine what to fetch based on view mode
      const params: {
        page: number;
        limit: number;
        domain?: string;
        phase?: string;
        search?: string;
        objective_type?: "template" | "teacher" | "all";
        include_teacher_objectives?: boolean;
        include_course_objectives?: boolean;
      } = {
        page,
        limit,
        domain: domainFilter || undefined,
        phase: phaseFilter || undefined,
        search: searchQuery || undefined,
      };

      if (viewMode === "template") {
        params.objective_type = "template";
      } else if (viewMode === "teacher") {
        params.objective_type = "teacher";
        // When viewing teacher objectives, also include shared course objectives
        params.include_course_objectives = true;
      } else {
        // "all" - include templates, own objectives, and shared course objectives
        params.include_teacher_objectives = true;
        params.include_course_objectives = true;
      }

      const response = await listLearningObjectives(params);

      setObjectives(response.items);
      setTotal(response.total);
    } catch (err) {
      console.error("Error fetching learning objectives:", err);
      setError("Er is een fout opgetreden bij het ophalen van de leerdoelen.");
    } finally {
      setLoading(false);
    }
  }

  // Check if user can edit/delete an objective
  function canModify(objective: LearningObjectiveDto): boolean {
    // Only the owner of a teacher-specific objective can modify it
    // Template objectives and shared objectives (owned by others) are read-only
    if (objective.is_template) return false;
    if (!user) return false;
    return objective.teacher_id === user.id;
  }

  // Check if this is a shared objective (teacher objective from someone else)
  function isShared(objective: LearningObjectiveDto): boolean {
    if (objective.is_template) return false;
    if (!user) return false;
    return objective.teacher_id !== user.id;
  }

  function openCreateModal() {
    setFormData({
      domain: "",
      title: "",
      description: "",
      order: 0,
      phase: "",
      is_template: false, // Teacher objectives are not templates
    });
    setIsCreateModalOpen(true);
  }

  function openEditModal(objective: LearningObjectiveDto) {
    if (!canModify(objective)) {
      alert("Centrale leerdoelen kunnen alleen door een beheerder worden bewerkt.");
      return;
    }
    setCurrentObjective(objective);
    setFormData({
      domain: objective.domain || "",
      title: objective.title,
      description: objective.description || "",
      order: objective.order,
      phase: objective.phase || "",
    });
    setIsEditModalOpen(true);
  }

  async function handleCreate() {
    if (!formData.title) {
      alert("Titel is verplicht");
      return;
    }

    try {
      // Create as teacher-specific objective (is_template: false)
      await createLearningObjective({
        ...formData as LearningObjectiveCreateDto,
        is_template: false,
      });
      setIsCreateModalOpen(false);
      fetchObjectives();
    } catch (err) {
      console.error("Error creating learning objective:", err);
      alert("Er is een fout opgetreden bij het aanmaken van het leerdoel.");
    }
  }

  async function handleUpdate() {
    if (!currentObjective) return;
    
    if (!canModify(currentObjective)) {
      alert("Centrale leerdoelen kunnen alleen door een beheerder worden bewerkt.");
      return;
    }

    try {
      await updateLearningObjective(
        currentObjective.id,
        formData as LearningObjectiveUpdateDto
      );
      setIsEditModalOpen(false);
      setCurrentObjective(null);
      fetchObjectives();
    } catch (err) {
      console.error("Error updating learning objective:", err);
      alert("Er is een fout opgetreden bij het bijwerken van het leerdoel.");
    }
  }

  async function handleDelete(objective: LearningObjectiveDto) {
    if (!canModify(objective)) {
      alert("Centrale leerdoelen kunnen alleen door een beheerder worden verwijderd.");
      return;
    }
    
    if (!confirm("Weet je zeker dat je dit leerdoel wilt verwijderen?")) {
      return;
    }

    try {
      await deleteLearningObjective(objective.id);
      fetchObjectives();
    } catch (err) {
      console.error("Error deleting learning objective:", err);
      alert("Er is een fout opgetreden bij het verwijderen van het leerdoel.");
    }
  }

  /**
   * Parse a CSV line, properly handling quoted fields that may contain commas.
   * Follows RFC 4180 CSV format:
   * - Fields may be enclosed in double quotes
   * - Quoted fields can contain commas and newlines
   * - Double quotes within quoted fields are escaped as ""
   */
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let fieldStart = true;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && (fieldStart || inQuotes)) {
        // Start or end of quoted field
        if (fieldStart && !inQuotes) {
          // Starting a quoted field - don't include the quote
          inQuotes = true;
          fieldStart = false;
        } else if (inQuotes) {
          // Check for escaped quote (double quote)
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++; // Skip next quote
          } else {
            // End of quoted field
            inQuotes = false;
          }
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
        fieldStart = true;
      } else {
        current += char;
        fieldStart = false;
      }
    }
    result.push(current.trim());
    
    return result;
  }

  async function handleImport() {
    if (!importText.trim()) {
      alert("Voer CSV-gegevens in");
      return;
    }

    try {
      // Parse CSV (expects: domein,nummer,titel,beschrijving,fase)
      const lines = importText.trim().split("\n");
      const items: LearningObjectiveImportItem[] = [];

      // Skip header if present (check for common Dutch/English header keywords)
      const firstLine = lines[0].toLowerCase();
      const hasHeader = firstLine.includes("domein") || 
                       firstLine.includes("domain") || 
                       firstLine.includes("nummer") ||
                       firstLine.includes("titel") ||
                       firstLine.includes("title");
      const startIdx = hasHeader ? 1 : 0;

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = parseCSVLine(line);
        if (parts.length < 2) continue;

        // Map phase codes to full phase names
        // B = Basis/Onderbouw, E = Eindniveau/Bovenbouw
        let phase = parts[4] || null;
        if (phase) {
          const phaseUpper = phase.toUpperCase();
          if (phaseUpper === 'B' || phaseUpper === 'ONDERBOUW') {
            phase = 'onderbouw';
          } else if (phaseUpper === 'E' || phaseUpper === 'BOVENBOUW') {
            phase = 'bovenbouw';
          }
          // Truncate if too long (max 20 chars for database)
          if (phase.length > 20) {
            phase = phase.substring(0, 20);
          }
        }

        items.push({
          domain: parts[0] || null,
          order: parts[1] ? parseInt(parts[1], 10) : 0,
          title: parts[2] || parts[1],  // fallback if structure differs
          description: parts[3] || null,
          phase: phase,
        });
      }

      // Import as teacher objectives (is_template: false)
      const result = await importLearningObjectives({ items }, undefined, false);
      setImportResult(result);
      if (result.errors.length === 0) {
        fetchObjectives();
      }
    } catch (err) {
      console.error("Error importing learning objectives:", err);
      alert("Er is een fout opgetreden bij het importeren.");
    }
  }

  const totalPages = Math.ceil(total / limit);

  if (loading && objectives.length === 0) {
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
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Leerdoelen / Eindtermen</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Bekijk centrale leerdoelen en beheer je eigen doelen.
            </p>
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
            <button
              onClick={openCreateModal}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              + Eigen Leerdoel
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Importeer CSV
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
            <p className="font-medium mb-1">Drie soorten leerdoelen:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Centraal</span> — Beheerd door de beheerder, gekoppeld aan rubric-criteria. Alleen-lezen voor docenten.</li>
              <li><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Eigen doel</span> — Jouw persoonlijke leerdoelen die je zelf kunt aanmaken en bewerken.</li>
              <li><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-800">Gedeeld</span> — Leerdoelen van collega&apos;s die aan dezelfde course zijn gekoppeld. Alleen-lezen.</li>
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
          onClick={() => setViewMode("template")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            viewMode === "template"
              ? "bg-amber-100 text-amber-700 border-amber-300"
              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
          }`}
        >
          Centrale doelen
        </button>
        <button
          onClick={() => setViewMode("teacher")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            viewMode === "teacher"
              ? "bg-emerald-100 text-emerald-700 border-emerald-300"
              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
          }`}
        >
          Mijn eigen doelen
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
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Zoek op titel of beschrijving..."
          className="h-9 w-64 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <input
          type="text"
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          placeholder="Domein (A, B, C...)"
          className="h-9 w-40 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {(searchQuery || domainFilter) && (
          <button
            onClick={() => {
              setSearchQuery("");
              setDomainFilter("");
            }}
            className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm shadow-sm hover:bg-gray-50"
          >
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <table className="w-full table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-36 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="w-28 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Domein
              </th>
              <th className="w-20 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Nr
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Titel
              </th>
              <th className="w-32 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Fase
              </th>
              <th className="w-44 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Acties
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {objectives.map((obj) => (
              <tr key={obj.id} className={`hover:bg-gray-50 ${
                obj.is_template 
                  ? "bg-amber-50/30" 
                  : isShared(obj) 
                    ? "bg-cyan-50/30" 
                    : ""
              }`}>
                <td className="w-36 px-4 py-3 text-sm">
                  {obj.is_template ? (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                      🏛️ Centraal
                    </span>
                  ) : isShared(obj) ? (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-cyan-100 text-cyan-800">
                      👥 Gedeeld
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                      👤 Eigen doel
                    </span>
                  )}
                </td>
                <td className="w-28 px-4 py-3 text-sm font-medium">{obj.domain || "-"}</td>
                <td className="w-20 px-4 py-3 text-sm">{obj.order}</td>
                <td className="px-4 py-3 text-sm">{obj.title}</td>
                <td className="w-32 px-4 py-3 text-sm">
                  {obj.phase ? (
                    <span className={`px-2 py-1 rounded text-xs ${
                      obj.phase === "onderbouw" 
                        ? "bg-blue-100 text-blue-800" 
                        : "bg-purple-100 text-purple-800"
                    }`}>
                      {obj.phase === "onderbouw" ? "Onderbouw" : "Bovenbouw"}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="w-44 px-4 py-3 text-sm text-right">
                  {canModify(obj) ? (
                    <>
                      <button
                        onClick={() => openEditModal(obj)}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                      >
                        Bewerken
                      </button>
                      <button
                        onClick={() => handleDelete(obj)}
                        className="text-red-600 hover:text-red-800"
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

        {objectives.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            Geen leerdoelen gevonden
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

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-2">Nieuw Eigen Leerdoel</h2>
            <p className="text-sm text-gray-600 mb-4">
              Dit leerdoel wordt als persoonlijk doel opgeslagen en is alleen voor jou zichtbaar.
            </p>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                  👤 Eigen doel
                </span>
                <span className="text-xs text-emerald-700">Dit doel kun je later bewerken en verwijderen.</span>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Domein
                </label>
                <input
                  type="text"
                  value={formData.domain || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, domain: e.target.value })
                  }
                  placeholder="A, B, C, D, E"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nummer
                </label>
                <input
                  type="number"
                  value={formData.order || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      order: parseInt(e.target.value, 10),
                    })
                  }
                  placeholder="9, 11, 13, 14, 16..."
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Titel *
                </label>
                <input
                  type="text"
                  value={formData.title || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Conceptontwikkeling"
                  className="w-full px-3 py-2 border rounded"
                  required
                />
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
                  placeholder="Ontwerprichtingen genereren en onderbouwen"
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

      {/* Edit Modal */}
      {isEditModalOpen && currentObjective && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-2">Eigen Leerdoel Bewerken</h2>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                  👤 Eigen doel
                </span>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Domein
                </label>
                <input
                  type="text"
                  value={formData.domain || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, domain: e.target.value })
                  }
                  placeholder="A, B, C, D, E"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nummer
                </label>
                <input
                  type="number"
                  value={formData.order || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      order: parseInt(e.target.value, 10),
                    })
                  }
                  placeholder="9, 11, 13, 14, 16..."
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Titel *
                </label>
                <input
                  type="text"
                  value={formData.title || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Conceptontwikkeling"
                  className="w-full px-3 py-2 border rounded"
                  required
                />
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
                  placeholder="Ontwerprichtingen genereren en onderbouwen"
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
                onClick={handleUpdate}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              >
                Opslaan
              </button>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setCurrentObjective(null);
                }}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-2">
              Importeer Eigen Leerdoelen (CSV)
            </h2>
            <p className="text-sm text-gray-600 mb-2">
              Geïmporteerde leerdoelen worden opgeslagen als jouw persoonlijke doelen.
            </p>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                  👤 Eigen doelen
                </span>
                <span className="text-xs text-emerald-700">Deze doelen kun je later bewerken en verwijderen.</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Formaat: domein,nummer,titel,beschrijving,fase
              <br />
              Bijvoorbeeld: D,9,Conceptontwikkeling,Ontwerprichtingen genereren en onderbouwen,onderbouw
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Plak CSV-gegevens hier..."
              className="w-full px-3 py-2 border rounded font-mono text-sm"
              rows={10}
            />
            {importResult && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                <p className="font-medium">Resultaat:</p>
                <p>Aangemaakt: {importResult.created}</p>
                <p>Bijgewerkt: {importResult.updated}</p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-red-600">Fouten:</p>
                    <ul className="list-disc list-inside text-sm">
                      {importResult.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleImport}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Importeren
              </button>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportText("");
                  setImportResult(null);
                }}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
