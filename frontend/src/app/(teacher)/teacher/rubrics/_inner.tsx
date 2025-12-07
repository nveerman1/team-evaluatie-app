"use client";
import Link from "next/link";
import { useEffect, useState, useMemo, useCallback } from "react";
import { rubricService, competencyService } from "@/services";
import { RubricListItem, Competency, CompetencyTree, CompetencyCategoryTreeItem, CompetencyTreeItem, CompetencyListResponse, CompetencyType, CompetencyCategory, CompetencyCreate, CompetencyUpdate } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { useAuth } from "@/hooks/useAuth";

type TabType = "peer" | "project" | "competencies";

// View mode type for competencies tab
type ViewMode = "all" | "central" | "teacher" | "shared";

// Initial form data for competency creation
const initialFormData: CompetencyCreate = {
  name: "",
  description: "",
  category_id: undefined,
  phase: "",
  level_descriptors: { "1": "", "2": "", "3": "", "4": "", "5": "" },
};

export default function RubricsListInner() {
  const { user } = useAuth();
  const [data, setData] = useState<RubricListItem[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [categories, setCategories] = useState<CompetencyCategory[]>([]);
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("peer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Competencies tab state (like competencies-beheer page)
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CompetencyCreate>(initialFormData);
  const [expandedCompetency, setExpandedCompetency] = useState<number | null>(null);
  const [editingCompetency, setEditingCompetency] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<CompetencyUpdate>({});

  async function fetchRubrics(query = "", scope: "peer" | "project") {
    setLoading(true);
    setError(null);
    try {
      const response = await rubricService.getRubrics(query, scope);
      setData(response.items || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
    } finally {
      setLoading(false);
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

  async function fetchCategories() {
    try {
      const cats = await competencyService.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  }

  async function fetchList(query = "", scope: TabType = activeTab) {
    if (scope === "competencies") {
      await fetchCompetencies();
    } else {
      await fetchRubrics(query, scope);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchList("", activeTab);
  }, [activeTab]);

  // Fetch competencies when filters change
  useEffect(() => {
    if (activeTab === "competencies") {
      fetchCompetencies();
    }
  }, [page, searchQuery, viewMode, categoryFilter, phaseFilter, activeTab]);

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
      setIsCreating(false);
      setFormData(initialFormData);
      fetchCompetencies();
    } catch (err: unknown) {
      console.error("Error creating competency:", err);
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 409) {
        alert("Er bestaat al een competentie met deze naam. Kies een andere naam.");
      } else {
        alert("Er is een fout opgetreden bij het aanmaken van de competentie.");
      }
    }
  }

  async function handleUpdate(competencyId: number) {
    try {
      await competencyService.updateCompetency(competencyId, editFormData);
      setEditingCompetency(null);
      setEditFormData({});
      fetchCompetencies();
    } catch (err: unknown) {
      console.error("Error updating competency:", err);
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 409) {
        alert("Er bestaat al een competentie met deze naam. Kies een andere naam.");
      } else {
        alert("Er is een fout opgetreden bij het bijwerken van de competentie.");
      }
    }
  }

  function toggleExpand(competencyId: number) {
    if (expandedCompetency === competencyId) {
      setExpandedCompetency(null);
      setEditingCompetency(null);
    } else {
      setExpandedCompetency(competencyId);
      setEditingCompetency(null);
    }
  }

  function startEdit(competency: Competency) {
    setEditingCompetency(competency.id);
    setEditFormData({
      name: competency.name,
      description: competency.description || "",
      category_id: competency.category_id,
      phase: competency.phase || "",
      level_descriptors: competency.level_descriptors || { "1": "", "2": "", "3": "", "4": "", "5": "" },
    });
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

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setQ("");
  };

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Rubrics</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Beheer je beoordelingsrubrics met criteria op 5 niveaus.
            </p>
          </div>
          {activeTab !== "competencies" ? (
            <Link
              href={`/teacher/rubrics/create?scope=${activeTab}`}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              + Nieuwe {activeTab === "peer" ? "team-evaluatie" : "projectbeoordeling"}
            </Link>
          ) : (
            <button
              onClick={() => {
                setIsCreating(true);
                setFormData(initialFormData);
              }}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              + Eigen Competentie
            </button>
          )}
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => handleTabChange("peer")}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "peer"
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Team-evaluatie (peer)
          </button>
          <button
            onClick={() => handleTabChange("project")}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "project"
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Projectbeoordeling
          </button>
          <button
            onClick={() => handleTabChange("competencies")}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "competencies"
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Competenties
          </button>
        </nav>
      </div>

      {activeTab !== "competencies" && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              className="h-9 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Zoek op titel/omschrijving..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  fetchList(q.trim(), activeTab);
                }
              }}
            />
            {q && (
              <button
                className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm shadow-sm hover:bg-gray-50"
                onClick={() => {
                  setQ("");
                  fetchList("", activeTab);
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

        {activeTab !== "competencies" && (
          <>
            {loading && (
              <div className="p-6">
                <Loading />
              </div>
            )}
            {error && !loading && (
              <div className="p-6">
                <ErrorMessage message={`Fout: ${error}`} />
              </div>
            )}
            {!loading && !error && data.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                <div className="text-gray-500 mb-4">
                  Geen rubrics gevonden.
                </div>
                <Link
                  href={`/teacher/rubrics/create?scope=${activeTab}`}
                  className="text-blue-600 hover:underline"
                >
                  Maak een nieuwe {activeTab === "peer" ? "team-evaluatie" : "projectbeoordeling"} aan
                </Link>
              </div>
            )}
            {!loading && !error && data.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide sticky left-0 bg-gray-50">
                          Titel
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                          Beschrijving
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                          # Criteria
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 tracking-wide">
                          Acties
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.map((r) => (
                        <tr key={r.id} className="bg-white hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium sticky left-0 bg-white">
                            {r.title}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-600">
                              {r.description || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                              {r.criteria_count}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Link
                                href={`/teacher/evaluations/create?rubric_id=${r.id}`}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm"
                              >
                                Gebruiken
                              </Link>
                              <Link
                                href={`/teacher/rubrics/${r.id}/edit`}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium shadow-sm"
                              >
                                Bewerken
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Competencies Tab Content - Like competencies-beheer page */}
        {activeTab === "competencies" && (
          <div className="space-y-6">
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

            {/* Filters - Combined in one bar */}
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek op naam of beschrijving..."
                className="h-9 w-64 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as ViewMode)}
                className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm"
              >
                <option value="all">Alle competenties</option>
                <option value="central">Centrale competenties</option>
                <option value="teacher">Mijn eigen competenties</option>
                <option value="shared">Gedeelde competenties</option>
              </select>
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm"
              >
                <option value="">Alle fasen</option>
                <option value="onderbouw">Onderbouw</option>
                <option value="bovenbouw">Bovenbouw</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value === "all" ? "all" : parseInt(e.target.value))}
                className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm"
              >
                <option value="all">Alle categorieën</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {(searchQuery || viewMode !== "all" || phaseFilter || categoryFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setViewMode("all");
                    setPhaseFilter("");
                    setCategoryFilter("all");
                  }}
                  className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm shadow-sm hover:bg-slate-50"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Inline Creation Form */}
            {isCreating && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                    👤 Eigen competentie
                  </span>
                  <span className="text-sm text-emerald-700">Nieuwe competentie aanmaken</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Naam *</label>
                    <input
                      type="text"
                      value={formData.name || ""}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="bijv. Samenwerken"
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Categorie</label>
                    <select
                      value={formData.category_id || ""}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="">Geen categorie</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fase</label>
                    <select
                      value={formData.phase || ""}
                      onChange={(e) => setFormData({ ...formData, phase: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="">Niet gespecificeerd</option>
                      <option value="onderbouw">Onderbouw</option>
                      <option value="bovenbouw">Bovenbouw</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Beschrijving</label>
                    <input
                      type="text"
                      value={formData.description || ""}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Korte beschrijving..."
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Niveaubeschrijvingen</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div key={level} className="flex flex-col">
                        <label className="text-xs font-medium text-gray-700 mb-1">Niveau {level}</label>
                        <textarea
                          value={formData.level_descriptors?.[level.toString()] || ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            level_descriptors: {
                              ...formData.level_descriptors,
                              [level.toString()]: e.target.value
                            }
                          })}
                          placeholder={`Niveau ${level}`}
                          className="w-full px-2 py-1.5 border rounded text-xs resize-none"
                          rows={3}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreate}
                    className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  >
                    Opslaan
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setFormData(initialFormData);
                    }}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    Annuleren
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-28 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="w-32 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Categorie
                    </th>
                    <th className="w-40 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Naam
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Beschrijving
                    </th>
                    <th className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Fase
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {competencies.map((comp) => {
                    const isExpanded = expandedCompetency === comp.id;
                    const isEditing = editingCompetency === comp.id;
                    
                    return [
                      <tr 
                        key={comp.id} 
                        className={`hover:bg-gray-50 cursor-pointer ${getRowBackground(comp)}`}
                        onClick={() => toggleExpand(comp.id)}
                      >
                        <td className="w-28 px-4 py-3 text-sm">
                          {getTypeBadge(comp)}
                        </td>
                        <td className="w-32 px-4 py-3 text-sm">
                          {comp.category_name ? (
                            <span className="font-medium">{comp.category_name}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="w-40 px-4 py-3 text-sm font-medium">{comp.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 truncate">
                          {comp.description || <span className="text-gray-400">-</span>}
                        </td>
                        <td className="w-24 px-4 py-3 text-sm">
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
                      </tr>,
                      isExpanded && (
                        <tr key={`${comp.id}-expanded`} className="bg-slate-50">
                          <td colSpan={5} className="p-4">
                            {isEditing && canModify(comp) ? (
                              // Edit form
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium mb-1">Naam</label>
                                    <input
                                      type="text"
                                      value={editFormData.name || ""}
                                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                      className="w-full px-3 py-2 border rounded"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-1">Categorie</label>
                                    <select
                                      value={editFormData.category_id || ""}
                                      onChange={(e) => setEditFormData({ ...editFormData, category_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                      className="w-full px-3 py-2 border rounded"
                                    >
                                      <option value="">Geen categorie</option>
                                      {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-1">Fase</label>
                                    <select
                                      value={editFormData.phase || ""}
                                      onChange={(e) => setEditFormData({ ...editFormData, phase: e.target.value })}
                                      className="w-full px-3 py-2 border rounded"
                                    >
                                      <option value="">Niet gespecificeerd</option>
                                      <option value="onderbouw">Onderbouw</option>
                                      <option value="bovenbouw">Bovenbouw</option>
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">Beschrijving</label>
                                  <textarea
                                    value={editFormData.description || ""}
                                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                    className="w-full px-3 py-2 border rounded"
                                    rows={2}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-2">Niveaubeschrijvingen</label>
                                  <div className="grid grid-cols-5 gap-2">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                      <div key={level} className="flex flex-col">
                                        <label className="text-xs font-medium text-gray-700 mb-1">Niveau {level}</label>
                                        <textarea
                                          value={editFormData.level_descriptors?.[level.toString()] || ""}
                                          onChange={(e) => setEditFormData({
                                            ...editFormData,
                                            level_descriptors: {
                                              ...editFormData.level_descriptors,
                                              [level.toString()]: e.target.value
                                            }
                                          })}
                                          className="w-full px-2 py-1.5 border rounded text-xs resize-none"
                                          rows={3}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleUpdate(comp.id)}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                  >
                                    Opslaan
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingCompetency(null);
                                      setEditFormData({});
                                    }}
                                    className="px-3 py-1.5 border text-sm rounded hover:bg-gray-100"
                                  >
                                    Annuleren
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // Read-only view with level descriptors
                              <>
                                {comp.category_description && (
                                  <p className="text-sm text-gray-600 mb-3">{comp.category_description}</p>
                                )}
                                <div className="text-xs font-medium text-slate-700 mb-2">
                                  Niveaubeschrijvingen (1–5)
                                </div>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                  {[1, 2, 3, 4, 5].map((level) => (
                                    <div key={level} className="flex min-h-[80px] flex-col rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-inner">
                                      <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Niveau {level}</span>
                                      <p className="text-[11px] text-slate-700">
                                        {comp.level_descriptors?.[level.toString()] || <em className="text-slate-400">Niet ingevuld</em>}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-4 flex justify-between items-center text-xs">
                                  <span className="text-gray-400">Klik om details te verbergen</span>
                                  <div className="flex gap-2">
                                    {canModify(comp) && (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            startEdit(comp);
                                          }}
                                          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                        >
                                          Bewerken
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(comp);
                                          }}
                                          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                                        >
                                          Verwijderen
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>

              {competencies.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  Geen competenties gevonden
                </div>
              )}
            </div>

            {/* Pagination */}
            {Math.ceil(total / limit) > 1 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100"
                >
                  Vorige
                </button>
                <span className="px-4 py-2">
                  Pagina {page} van {Math.ceil(total / limit)}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(Math.ceil(total / limit), p + 1))}
                  disabled={page === Math.ceil(total / limit)}
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
        )}
      </main>
    </>
  );
}
