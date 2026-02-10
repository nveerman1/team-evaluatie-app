"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiAuthError } from "@/lib/api";
import { projectPlanService } from "@/services/projectplan.service";
import { ProjectPlanListItem, PlanStatus, ProjectPlanStatus } from "@/dtos/projectplan.dto";
import { Loading, ErrorMessage } from "@/components";

type Course = {
  id: number;
  name: string;
};

export default function ProjectPlansListInner() {
  const [data, setData] = useState<ProjectPlanListItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [courseFilter, setCourseFilter] = useState<string>("all");

  // Build courses list from actual projectplans data
  useEffect(() => {
    if (data.length > 0) {
      const uniqueCourses = new Map<number, Course>();
      data.forEach(item => {
        if (item.course_id && item.course_name) {
          uniqueCourses.set(item.course_id, {
            id: item.course_id,
            name: item.course_name
          });
        }
      });
      setCourses(Array.from(uniqueCourses.values()));
    }
  }, [data]);

  async function fetchList(courseId?: number) {
    console.log('[FETCHLIST] Starting fetchList with courseId:', courseId);
    setLoading(true);
    setError(null);
    try {
      const response = await projectPlanService.listProjectPlans({
        course_id: courseId,
      });
      console.log('[FETCHLIST] Got response:', response);
      console.log('[FETCHLIST] Response items count:', response.items?.length);
      console.log('[FETCHLIST] First item status (explicit):', response.items?.[0]?.status);
      console.log('[FETCHLIST] First item (full):', JSON.stringify(response.items?.[0], null, 2));
      setData(response.items || []);
      console.log('[FETCHLIST] Data state set with', response.items?.length, 'items');
    } catch (e: any) {
      console.error('[FETCHLIST] Error:', e);
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const courseId = courseFilter === "all" ? undefined : Number(courseFilter);
    fetchList(courseId);
  }, [courseFilter]);

  const handleDelete = async (id: number) => {
    if (!confirm("Weet je zeker dat je dit projectplan wilt verwijderen?"))
      return;
    try {
      await projectPlanService.deleteProjectPlan(id);
      const courseId = courseFilter === "all" ? undefined : Number(courseFilter);
      fetchList(courseId);
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        alert(e.originalMessage);
      } else {
        alert(e?.response?.data?.detail || e?.message || "Verwijderen mislukt");
      }
    }
  };

  // Filter data by search query
  const filteredData = data.filter((item) => {
    const matchesSearch = searchQuery === "" || 
      (item.title && item.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.course_name && item.course_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.project_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Group projectplans by course
  const groupedByCourse: Record<string, ProjectPlanListItem[]> = {};
  filteredData.forEach((item) => {
    const courseKey = item.course_name || "Geen vak";
    if (!groupedByCourse[courseKey]) {
      groupedByCourse[courseKey] = [];
    }
    groupedByCourse[courseKey].push(item);
  });

  // Helper to get status badge props
  const getStatusBadge = (status: PlanStatus, count: number) => {
    const badges: Record<PlanStatus, { bg: string; text: string; label: string }> = {
      [PlanStatus.CONCEPT]: { bg: "bg-gray-100", text: "text-gray-700", label: "Concept" },
      [PlanStatus.INGEDIEND]: { bg: "bg-blue-100", text: "text-blue-700", label: "Ingediend" },
      [PlanStatus.GO]: { bg: "bg-green-100", text: "text-green-700", label: "GO" },
      [PlanStatus.NO_GO]: { bg: "bg-red-100", text: "text-red-700", label: "NO-GO" },
    };
    const badge = badges[status];
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
        {count} {badge.label}
      </span>
    );
  };

  // Helper to get projectplan status badge  
  const getProjectPlanStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      "draft": { bg: "bg-gray-100", text: "text-gray-700", label: "Concept" },
      "open": { bg: "bg-blue-100", text: "text-blue-700", label: "Open" },
      "published": { bg: "bg-green-100", text: "text-green-700", label: "Gepubliceerd" },
      "closed": { bg: "bg-red-100", text: "text-red-700", label: "Gesloten" },
    };
    const badge = badges[status] || badges["draft"];
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  // Handle status change
  const handleStatusChange = async (id: number, newStatus: string) => {
    console.log(`[HANDLER ENTRY] handleStatusChange called with id=${id}, newStatus=${newStatus}`);
    
    try {
      console.log(`[DEBUG] Starting status update for projectplan ${id} to ${newStatus}`);
      console.log('[DEBUG] About to call projectPlanService.updateProjectPlan');
      console.log('[DEBUG] Payload:', { status: newStatus });
      
      const response = await projectPlanService.updateProjectPlan(id, { status: newStatus as any });
      
      console.log('[DEBUG] API call completed successfully');
      console.log('[DEBUG] Full response object:', JSON.stringify(response, null, 2));
      console.log('Update response:', response);
      console.log('Response status:', response.status);
      
      const courseId = courseFilter === "all" ? undefined : Number(courseFilter);
      console.log('[DEBUG] About to fetch list with courseId:', courseId);
      
      await fetchList(courseId);
      
      console.log('[DEBUG] List refreshed');
      console.log('[DEBUG] Current data after refresh count:', data.length);
      console.log('[DEBUG] First item in current data:', JSON.stringify(data[0], null, 2));
      console.log('[DEBUG] First item status:', data[0]?.status);
    } catch (e: any) {
      console.error('[DEBUG] Error caught in handleStatusChange:', e);
      console.error('[DEBUG] Error type:', typeof e, e?.constructor?.name);
      console.error('Status update error:', e);
      if (e instanceof ApiAuthError) {
        alert(e.originalMessage);
      } else {
        alert(e?.response?.data?.detail || e?.message || "Status wijzigen mislukt");
      }
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Projectplannen</h1>
            <p className="text-sm text-slate-500 mt-1">
              Beheer projectplannen met GO/NO-GO beoordeling per team.
            </p>
          </div>
          <Link
            href="/teacher/projectplans/create"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Nieuw projectplan
          </Link>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* FilterBar */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Left side: search + dropdowns */}
            <div className="flex flex-wrap gap-3 items-center flex-1">
              {/* Search field */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Zoek op vak, project…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Course dropdown */}
              <select
                className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 min-w-[140px]"
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
              >
                <option value="all">Alle vakken</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

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
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-500">
            Geen projectplannen gevonden.
          </div>
        )}
      {!loading && !error && Object.keys(groupedByCourse).length > 0 &&
        Object.keys(groupedByCourse).map((courseName) => (
          <section key={courseName} className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-800 px-2">
              {courseName}
            </h3>
            <div className="space-y-3">
              {groupedByCourse[courseName].map((item) => {
                return (
              <div
                key={item.id}
                className="group flex items-stretch justify-between gap-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                {/* Left side: content */}
                <div className="flex flex-1 flex-col gap-1">
                  {/* Title and Status */}
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {item.title || `Projectplan: ${item.project_name}`}
                    </h3>
                    {getProjectPlanStatusBadge(item.status)}
                  </div>

                  {/* Status selector */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">Zichtbaarheid:</span>
                    <select
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      className="text-xs rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-100"
                    >
                      <option value="draft">Concept (niet zichtbaar voor studenten)</option>
                      <option value="open">Open (zichtbaar voor studenten)</option>
                      <option value="published">Gepubliceerd (zichtbaar voor studenten)</option>
                      <option value="closed">Gesloten (zichtbaar maar niet te bewerken)</option>
                    </select>
                  </div>

                  {/* Project name */}
                  <div className="text-sm text-slate-600">
                    Project: {item.project_name}
                  </div>

                  {/* Version */}
                  {item.version && (
                    <div className="text-sm text-slate-600">
                      Versie: {item.version}
                    </div>
                  )}

                  {/* Team count */}
                  <div className="text-sm text-slate-500">
                    {item.team_count} {item.team_count === 1 ? "team" : "teams"}
                  </div>

                  {/* Status summary badges */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.teams_summary.concept > 0 && getStatusBadge(PlanStatus.CONCEPT, item.teams_summary.concept)}
                    {item.teams_summary.ingediend > 0 && getStatusBadge(PlanStatus.INGEDIEND, item.teams_summary.ingediend)}
                    {item.teams_summary.go > 0 && getStatusBadge(PlanStatus.GO, item.teams_summary.go)}
                    {item.teams_summary["no-go"] > 0 && getStatusBadge(PlanStatus.NO_GO, item.teams_summary["no-go"])}
                  </div>

                  {/* Last updated */}
                  <div className="text-xs text-slate-500">
                    Laatst bijgewerkt: {new Date(item.updated_at).toLocaleDateString("nl-NL")}
                  </div>
                </div>

                {/* Right side: buttons */}
                <div className="flex shrink-0 items-center gap-2">
                  {/* Overview button */}
                  <Link
                    href={`/teacher/projectplans/${item.id}?tab=overzicht`}
                    className="hidden rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 sm:inline-flex"
                  >
                    Overzicht
                  </Link>

                  {/* Projectplannen button */}
                  <Link
                    href={`/teacher/projectplans/${item.id}?tab=projectplannen`}
                    className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    Projectplannen
                  </Link>

                  {/* Delete button - icon only */}
                  <button
                    onClick={() => handleDelete(item.id)}
                    aria-label="Verwijder projectplan"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-500 transition hover:border-red-200 hover:bg-red-100"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
