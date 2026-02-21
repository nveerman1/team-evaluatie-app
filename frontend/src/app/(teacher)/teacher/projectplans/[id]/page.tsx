"use client";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ApiAuthError } from "@/lib/api";
import { projectPlanService } from "@/services/projectplan.service";
import { 
  ProjectPlanDetail, 
  ProjectPlanTeam, 
  ProjectPlanTeamOverviewItem,
  PlanStatus,
  SectionKey,
  SectionStatus,
  ProjectPlanSectionUpdate,
  ProjectPlanTeamUpdate,
  SuggestClientItem,
} from "@/dtos/projectplan.dto";
import { Loading, ErrorMessage } from "@/components";

export default function ProjectPlanDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectPlanId = Number(params?.id);
  const tab = searchParams?.get("tab") || "overzicht";
  const teamParam = searchParams?.get("team");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectPlanDetail | null>(null);
  const [overview, setOverview] = useState<ProjectPlanTeamOverviewItem[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<ProjectPlanTeam | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(new Set());
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [savingTeam, setSavingTeam] = useState(false);

  // Client linking state (Feature A)
  const [clientSuggestions, setClientSuggestions] = useState<SuggestClientItem[]>([]);
  const [loadingClientSuggestions, setLoadingClientSuggestions] = useState(false);
  const [linkingClient, setLinkingClient] = useState(false);
  
  // Refs for section feedback textareas
  const feedbackRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Section metadata
  const sectionMetadata: Record<SectionKey, { title: string; description: string }> = {
    [SectionKey.CLIENT]: { title: "1. Opdrachtgever", description: "Wie is de opdrachtgever?" },
    [SectionKey.PROBLEM]: { title: "2. Probleemstelling", description: "Wat is het probleem?" },
    [SectionKey.GOAL]: { title: "3. Doelstelling", description: "Wat is het doel?" },
    [SectionKey.METHOD]: { title: "4. Methode", description: "Hoe gaan jullie te werk?" },
    [SectionKey.PLANNING]: { title: "5. Planning", description: "Wat is jullie planning?" },
    [SectionKey.TASKS]: { title: "6. Taakverdeling", description: "Wie doet wat?" },
    [SectionKey.MOTIVATION]: { title: "7. Motivatie", description: "Waarom dit project?" },
    [SectionKey.RISKS]: { title: "8. Risico's", description: "Welke risico's zijn er?" },
  };

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await projectPlanService.getProjectPlan(projectPlanId);
      setDetail(result);
      
      // Auto-select first team if teamParam is provided
      if (teamParam && result.teams.length > 0) {
        const team = result.teams.find(t => t.team_number === Number(teamParam));
        if (team) {
          setSelectedTeamId(team.id);
          setSelectedTeam(team);
        } else if (result.teams[0]) {
          setSelectedTeamId(result.teams[0].id);
          setSelectedTeam(result.teams[0]);
        }
      } else if (result.teams.length > 0) {
        setSelectedTeamId(result.teams[0].id);
        setSelectedTeam(result.teams[0]);
      }
    } catch (e: unknown) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        const err = e as { response?: { data?: { detail?: string } }; message?: string };
        setError(err?.response?.data?.detail || err?.message || "Laden mislukt");
      }
    } finally {
      setLoading(false);
    }
  }, [projectPlanId, teamParam]);

  const loadOverview = useCallback(async () => {
    try {
      const result = await projectPlanService.getProjectPlanOverview(projectPlanId, {
        search: searchQuery || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setOverview(result);
    } catch (e: unknown) {
      console.error("Failed to load overview", e);
    }
  }, [projectPlanId, searchQuery, statusFilter]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (tab === "overzicht") {
      loadOverview();
    }
  }, [tab, loadOverview]);

  // When team selection changes, load that team's data
  useEffect(() => {
    if (selectedTeamId && detail) {
      const team = detail.teams.find(t => t.id === selectedTeamId);
      setSelectedTeam(team || null);
    }
  }, [selectedTeamId, detail]);

  // Load client suggestions when a team is selected (Feature A)
  useEffect(() => {
    if (!selectedTeamId || tab !== "projectplannen") {
      setClientSuggestions([]);
      return;
    }
    const clientSection = selectedTeam?.sections.find(s => s.key === SectionKey.CLIENT);
    if (!clientSection?.client?.organisation || clientSection.client_id) {
      setClientSuggestions([]);
      return;
    }
    let cancelled = false;
    setLoadingClientSuggestions(true);
    projectPlanService.suggestClient(projectPlanId, selectedTeamId)
      .then(results => {
        if (!cancelled) setClientSuggestions(results);
      })
      .catch(() => {
        if (!cancelled) setClientSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingClientSuggestions(false);
      });
    return () => { cancelled = true; };
  }, [selectedTeamId, selectedTeam, tab, projectPlanId]);

  const handleLinkClient = async (action: 'match_existing' | 'create_new', clientId?: number) => {
    if (!selectedTeamId) return;
    setLinkingClient(true);
    try {
      await projectPlanService.linkClient(projectPlanId, selectedTeamId, {
        action,
        client_id: clientId,
      });
      await loadDetail();
      setClientSuggestions([]);
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Koppelen mislukt");
    } finally {
      setLinkingClient(false);
    }
  };

  const handleTabChange = (newTab: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", newTab);
    router.push(url.pathname + url.search);
  };

  const handleTeamClick = (teamId: number) => {
    setSelectedTeamId(teamId);
    handleTabChange("projectplannen");
  };

  const toggleSection = (sectionKey: SectionKey) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionKey)) {
        newSet.delete(sectionKey);
      } else {
        newSet.add(sectionKey);
      }
      return newSet;
    });
  };

  const handleSectionFeedback = async (
    sectionKey: SectionKey,
    status: SectionStatus,
    note: string
  ) => {
    if (!selectedTeamId) return;
    setSavingSection(sectionKey);
    try {
      await projectPlanService.updateSectionFeedback(
        projectPlanId,
        selectedTeamId,
        sectionKey,
        { status, teacher_note: note }
      );
      // Reload detail to get updated data
      await loadDetail();
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Opslaan mislukt");
    } finally {
      setSavingSection(null);
    }
  };

  const handleTeamStatusUpdate = async (status: PlanStatus) => {
    if (!selectedTeamId) return;
    if (!confirm(`Weet je zeker dat je dit team wilt markeren als ${status === PlanStatus.GO ? "GO" : "NO-GO"}?`)) {
      return;
    }
    setSavingTeam(true);
    try {
      await projectPlanService.updateTeamStatus(
        projectPlanId,
        selectedTeamId,
        { status }
      );
      await loadDetail();
      alert(`Team status bijgewerkt naar ${status === PlanStatus.GO ? "GO" : "NO-GO"}`);
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Opslaan mislukt");
    } finally {
      setSavingTeam(false);
    }
  };

  if (loading) return <Loading />;
  if (error && !detail) return <ErrorMessage message={error} />;
  if (!detail) return <ErrorMessage message="Geen data gevonden" />;

  const getStatusBadge = (status: PlanStatus) => {
    const badges: Record<PlanStatus, { className: string; label: string }> = {
      [PlanStatus.CONCEPT]: { className: "px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700", label: "Concept" },
      [PlanStatus.INGEDIEND]: { className: "px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700", label: "Ingediend" },
      [PlanStatus.GO]: { className: "px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700", label: "GO" },
      [PlanStatus.NO_GO]: { className: "px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700", label: "NO-GO" },
    };
    const badge = badges[status];
    return <span className={badge.className}>{badge.label}</span>;
  };

  const getSectionStatusBadge = (status: SectionStatus) => {
    const badges: Record<SectionStatus, { className: string; label: string }> = {
      [SectionStatus.EMPTY]: { className: "text-gray-400", label: "Leeg" },
      [SectionStatus.DRAFT]: { className: "text-gray-600", label: "Concept" },
      [SectionStatus.SUBMITTED]: { className: "text-blue-600", label: "Ingediend" },
      [SectionStatus.APPROVED]: { className: "text-green-600", label: "✓ Akkoord" },
      [SectionStatus.REVISION]: { className: "text-orange-600", label: "↻ Aanpassen" },
    };
    const badge = badges[status];
    return <span className={badge.className + " text-xs font-medium"}>{badge.label}</span>;
  };

  // Filter overview teams
  const filteredOverview = overview.filter(team => {
    if (statusFilter !== "all" && team.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        team.team_name.toLowerCase().includes(query) ||
        team.team_members.some(m => m.toLowerCase().includes(query)) ||
        (team.title && team.title.toLowerCase().includes(query))
      );
    }
    return true;
  });

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href="/teacher/projectplans"
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  ← Terug naar overzicht
                </Link>
              </div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {detail.title || `Projectplan: ${detail.project_name}`}
              </h1>
              <div className="flex flex-wrap gap-2 mt-2 text-sm text-slate-600">
                <span>Project: {detail.project_name}</span>
                {detail.version && <span>• Versie: {detail.version}</span>}
                <span>• {detail.team_count} {detail.team_count === 1 ? "team" : "teams"}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-6 border-b border-slate-200">
            <button
              onClick={() => handleTabChange("overzicht")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === "overzicht"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Overzicht
            </button>
            <button
              onClick={() => handleTabChange("projectplannen")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === "projectplannen"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Projectplannen
            </button>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Tab 1: Overzicht */}
        {tab === "overzicht" && (
          <div className="space-y-4">
            {/* Search and Filter */}
            <div className="flex flex-wrap gap-3 items-center">
              <input
                className="h-9 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Zoek op team, leerling…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Alle statussen</option>
                <option value="concept">Concept</option>
                <option value="ingediend">Ingediend</option>
                <option value="go">GO</option>
                <option value="no-go">NO-GO</option>
              </select>
            </div>

            {/* Teams Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                        Team
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide min-w-[200px]">
                        Leden
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                        Titel
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                        Voortgang
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                        Laatste update
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredOverview.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                          Geen teams gevonden
                        </td>
                      </tr>
                    )}
                    {filteredOverview.map((team) => (
                      <tr
                        key={team.id}
                        className="bg-white hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleTeamClick(team.id)}
                      >
                        <td className="px-5 py-3 font-medium">
                          Team {team.team_number || team.team_name}
                        </td>
                        <td className="px-5 py-3">
                          <div className="text-sm text-gray-600">
                            {team.team_members.join(", ")}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">
                            {team.title || <span className="text-gray-400 italic">Geen titel</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(team.status)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500"
                                style={{ width: `${(team.sections_filled / team.sections_total) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">
                              {team.sections_filled}/{team.sections_total}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {new Date(team.last_updated).toLocaleDateString("nl-NL")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Projectplannen */}
        {tab === "projectplannen" && (
          <div className="space-y-4">
            {/* Team Selector - Sticky */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 p-4 shadow-sm">
              <label className="block text-sm font-medium mb-2">Selecteer team:</label>
              <select
                className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
                value={selectedTeamId || ""}
                onChange={(e) => setSelectedTeamId(Number(e.target.value))}
              >
                {detail.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    Team {team.team_number || team.project_team_id} - {team.team_members.join(", ")} {team.title ? `- ${team.title}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedTeam && (
              <>
                {/* Team Info Card */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {selectedTeam.title || `Team ${selectedTeam.team_number || selectedTeam.project_team_id}`}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Leden: {selectedTeam.team_members.join(", ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(selectedTeam.status)}
                      {selectedTeam.locked && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          🔒 Vergrendeld
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedTeam.global_teacher_note && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <strong>Globale feedback:</strong> {selectedTeam.global_teacher_note}
                      </p>
                    </div>
                  )}
                </div>

                {/* Sections Accordion */}
                <div className="space-y-3">
                  {selectedTeam.sections
                    .sort((a, b) => {
                      // Define the fixed order of sections
                      const order = [
                        SectionKey.CLIENT,
                        SectionKey.PROBLEM,
                        SectionKey.GOAL,
                        SectionKey.METHOD,
                        SectionKey.PLANNING,
                        SectionKey.TASKS,
                        SectionKey.MOTIVATION,
                        SectionKey.RISKS,
                      ];
                      return order.indexOf(a.key) - order.indexOf(b.key);
                    })
                    .map((section) => {
                    const meta = sectionMetadata[section.key];
                    const isExpanded = expandedSections.has(section.key);
                    const isSaving = savingSection === section.key;

                    return (
                      <div
                        key={section.key}
                        className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
                      >
                        {/* Section Header */}
                        <button
                          onClick={() => toggleSection(section.key)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold">{meta.title}</span>
                            {getSectionStatusBadge(section.status)}
                          </div>
                          <svg
                            className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Section Content */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Left: Teacher Feedback */}
                              <div className="space-y-3">
                                <h4 className="text-sm font-medium text-gray-700">Docent feedback</h4>
                                <textarea
                                  ref={(el) => {
                                    feedbackRefs.current[section.key] = el;
                                  }}
                                  className="w-full h-32 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                  placeholder="Schrijf hier feedback voor de studenten..."
                                  defaultValue={section.teacher_note || ""}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      const textarea = feedbackRefs.current[section.key];
                                      handleSectionFeedback(section.key, SectionStatus.APPROVED, textarea?.value || "");
                                    }}
                                    disabled={isSaving}
                                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                                  >
                                    ✓ Akkoord
                                  </button>
                                  <button
                                    onClick={() => {
                                      const textarea = feedbackRefs.current[section.key];
                                      handleSectionFeedback(section.key, SectionStatus.REVISION, textarea?.value || "");
                                    }}
                                    disabled={isSaving}
                                    className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                                  >
                                    ↻ Aanpassen
                                  </button>
                                </div>
                              </div>

                              {/* Right: Student Content */}
                              <div className="space-y-3">
                                <h4 className="text-sm font-medium text-gray-700">Student inhoud</h4>
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 min-h-[8rem] text-sm">
                                  {section.key === SectionKey.CLIENT && section.client ? (
                                    <div className="space-y-1">
                                      {section.client.organisation && <p><strong>Organisatie:</strong> {section.client.organisation}</p>}
                                      {section.client.contact && <p><strong>Contact:</strong> {section.client.contact}</p>}
                                      {section.client.email && <p><strong>Email:</strong> {section.client.email}</p>}
                                      {section.client.phone && <p><strong>Telefoon:</strong> {section.client.phone}</p>}
                                      {section.client.description && <p><strong>Beschrijving:</strong> {section.client.description}</p>}
                                    </div>
                                  ) : section.text ? (
                                    <p className="whitespace-pre-wrap">{section.text}</p>
                                  ) : (
                                    <p className="text-gray-400 italic">Nog geen inhoud</p>
                                  )}
                                </div>

                                {/* Client linking banner (Feature A) */}
                                {section.key === SectionKey.CLIENT && section.client?.organisation && (
                                  <div className="mt-3">
                                    {section.client_id ? (
                                      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                                        <span>✓</span>
                                        <span>Gekoppeld aan{" "}
                                          <a
                                            href={`/teacher/clients/${section.client_id}`}
                                            className="font-medium underline hover:text-green-900"
                                          >
                                            {section.linked_organization ?? `opdrachtgever #${section.client_id}`}
                                          </a>
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-3 text-sm">
                                        <p className="font-medium text-amber-800 mb-2">Opdrachtgever koppelen aan CMS?</p>
                                        {loadingClientSuggestions ? (
                                          <p className="text-amber-600 text-xs">Zoeken naar overeenkomsten…</p>
                                        ) : clientSuggestions.length > 0 ? (
                                          <div className="space-y-2">
                                            {clientSuggestions.slice(0, 3).map(s => (
                                              <div key={s.id} className="flex items-center justify-between gap-2">
                                                <span className="text-amber-900 text-xs truncate">
                                                  {s.organization}
                                                  {s.email && <span className="text-amber-600"> · {s.email}</span>}
                                                  <span className="ml-1 text-amber-500">({Math.round(s.match_score * 100)}%)</span>
                                                </span>
                                                <button
                                                  onClick={() => handleLinkClient('match_existing', s.id)}
                                                  disabled={linkingClient}
                                                  className="shrink-0 px-2 py-1 rounded bg-amber-600 text-white text-xs hover:bg-amber-700 disabled:opacity-50"
                                                >
                                                  Koppelen
                                                </button>
                                              </div>
                                            ))}
                                            <button
                                              onClick={() => handleLinkClient('create_new')}
                                              disabled={linkingClient}
                                              className="mt-1 text-xs text-amber-700 underline hover:text-amber-900 disabled:opacity-50"
                                            >
                                              Toch als nieuwe opdrachtgever aanmaken
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <span className="text-amber-700 text-xs">Geen overeenkomst gevonden.</span>
                                            <button
                                              onClick={() => handleLinkClient('create_new')}
                                              disabled={linkingClient}
                                              className="px-2 py-1 rounded bg-amber-600 text-white text-xs hover:bg-amber-700 disabled:opacity-50"
                                            >
                                              Nieuwe opdrachtgever aanmaken in CMS
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Sticky Bar: GO/NO-GO */}
                <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 p-4 shadow-lg rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Globale beslissing voor dit team
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleTeamStatusUpdate(PlanStatus.GO)}
                        disabled={savingTeam}
                        className="px-6 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
                      >
                        ✓ GO
                      </button>
                      <button
                        onClick={() => handleTeamStatusUpdate(PlanStatus.NO_GO)}
                        disabled={savingTeam}
                        className="px-6 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
                      >
                        ✗ NO-GO
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
