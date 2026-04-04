"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiAuthError } from "@/lib/api";
import { projectPlanService } from "@/services/projectplan.service";
import { ProjectPlanListItem } from "@/dtos/projectplan.dto";
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
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Build courses list from actual projectplans data
  useEffect(() => {
    if (data.length > 0) {
      const uniqueCourses = new Map<number, Course>();
      data.forEach((item) => {
        if (item.course_id && item.course_name) {
          uniqueCourses.set(item.course_id, {
            id: item.course_id,
            name: item.course_name,
          });
        }
      });
      setCourses(Array.from(uniqueCourses.values()));
    }
  }, [data]);

  async function fetchList(courseId?: number) {
    console.log("[FETCHLIST] Starting fetchList with courseId:", courseId);
    setLoading(true);
    setError(null);
    try {
      const response = await projectPlanService.listProjectPlans({
        course_id: courseId,
      });
      console.log("[FETCHLIST] Got response:", response);
      console.log("[FETCHLIST] Response items count:", response.items?.length);
      console.log(
        "[FETCHLIST] First item status (explicit):",
        response.items?.[0]?.status,
      );
      console.log(
        "[FETCHLIST] First item (full):",
        JSON.stringify(response.items?.[0], null, 2),
      );
      setData(response.items || []);
      console.log(
        "[FETCHLIST] Data state set with",
        response.items?.length,
        "items",
      );
    } catch (e: any) {
      console.error("[FETCHLIST] Error:", e);
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
      const courseId =
        courseFilter === "all" ? undefined : Number(courseFilter);
      fetchList(courseId);
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        alert(e.originalMessage);
      } else {
        alert(e?.response?.data?.detail || e?.message || "Verwijderen mislukt");
      }
    }
  };

  // Filter data by search query and status
  const filteredData = data.filter((item) => {
    const matchesSearch =
      searchQuery === "" ||
      (item.title &&
        item.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.course_name &&
        item.course_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.project_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
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

  // Helper to get projectplan status info for the dropdown button pill
  const getStatusInfo = (status: string): { label: string; className: string } => {
    const info: Record<string, { label: string; className: string }> = {
      draft: {
        label: "Concept",
        className: "bg-amber-50 text-amber-700 ring-amber-200",
      },
      open: {
        label: "Open",
        className: "bg-sky-50 text-sky-700 ring-sky-200",
      },
      published: {
        label: "Gepubliceerd",
        className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      },
      closed: {
        label: "Gesloten",
        className: "bg-red-50 text-red-700 ring-red-200",
      },
    };
    return info[status] || info["draft"];
  };

  // Handle status change
  const handleStatusChange = async (id: number, newStatus: string) => {
    console.log(
      `[HANDLER ENTRY] handleStatusChange called with id=${id}, newStatus=${newStatus}`,
    );

    try {
      console.log(
        `[DEBUG] Starting status update for projectplan ${id} to ${newStatus}`,
      );
      console.log("[DEBUG] About to call projectPlanService.updateProjectPlan");
      console.log("[DEBUG] Payload:", { status: newStatus });

      const response = await projectPlanService.updateProjectPlan(id, {
        status: newStatus as any,
      });

      console.log("[DEBUG] API call completed successfully");
      console.log(
        "[DEBUG] Full response object:",
        JSON.stringify(response, null, 2),
      );
      console.log("Update response:", response);
      console.log("Response status:", response.status);

      const courseId =
        courseFilter === "all" ? undefined : Number(courseFilter);
      console.log("[DEBUG] About to fetch list with courseId:", courseId);

      await fetchList(courseId);

      console.log("[DEBUG] List refreshed");
      console.log("[DEBUG] Current data after refresh count:", data.length);
      console.log(
        "[DEBUG] First item in current data:",
        JSON.stringify(data[0], null, 2),
      );
      console.log("[DEBUG] First item status:", data[0]?.status);
    } catch (e: any) {
      console.error("[DEBUG] Error caught in handleStatusChange:", e);
      console.error("[DEBUG] Error type:", typeof e, e?.constructor?.name);
      console.error("Status update error:", e);
      if (e instanceof ApiAuthError) {
        alert(e.originalMessage);
      } else {
        alert(
          e?.response?.data?.detail || e?.message || "Status wijzigen mislukt",
        );
      }
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Projectplannen
            </h1>
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

              {/* Status dropdown */}
              <select
                className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 min-w-[140px]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Alle statussen</option>
                <option value="draft">Concept</option>
                <option value="open">Open</option>
                <option value="published">Gepubliceerd</option>
                <option value="closed">Gesloten</option>
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
        {!loading &&
          !error &&
          Object.keys(groupedByCourse).length > 0 &&
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
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        {/* Left side: content */}
                        <div className="min-w-0 flex-1">
                          {/* Title + Status dropdown button */}
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-semibold text-slate-900">
                              {item.title || `Projectplan: ${item.project_name}`}
                            </h3>
                            {/* Status dropdown: visual button with transparent select overlay */}
                            <div className="relative inline-flex items-center">
                              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${getStatusInfo(item.status).className}`}
                                >
                                  {getStatusInfo(item.status).label}
                                </span>
                                <svg
                                  className="h-3 w-3 text-slate-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                              </div>
                              <select
                                value={item.status}
                                onChange={(e) =>
                                  handleStatusChange(item.id, e.target.value)
                                }
                                className="absolute inset-0 w-full cursor-pointer opacity-0"
                              >
                                <option value="draft">
                                  Concept (niet zichtbaar voor studenten)
                                </option>
                                <option value="open">
                                  Open (zichtbaar voor studenten)
                                </option>
                                <option value="published">
                                  Gepubliceerd (zichtbaar voor studenten)
                                </option>
                                <option value="closed">
                                  Gesloten (zichtbaar maar niet te bewerken)
                                </option>
                              </select>
                            </div>
                          </div>

                          {/* Project subtitle */}
                          <div className="mt-1 text-sm text-slate-500">
                            Project: {item.project_name}
                          </div>

                          {/* Meta badges */}
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1">
                              {item.team_count}{" "}
                              {item.team_count === 1 ? "team" : "teams"}
                            </span>
                            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700 ring-1 ring-emerald-200">
                              {item.teams_summary.go} GO
                            </span>
                            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-amber-200">
                              {item.teams_summary.concept} Concept
                            </span>
                            {item.teams_summary.ingediend > 0 && (
                              <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-700 ring-1 ring-blue-200">
                                {item.teams_summary.ingediend} Ingediend
                              </span>
                            )}
                            {item.teams_summary["no-go"] > 0 && (
                              <span className="rounded-lg bg-red-50 px-2.5 py-1 text-red-700 ring-1 ring-red-200">
                                {item.teams_summary["no-go"]} NO-GO
                              </span>
                            )}
                          </div>

                          {/* Last updated */}
                          <div className="mt-4 text-sm text-slate-500">
                            Laatst bijgewerkt:{" "}
                            {new Date(item.updated_at).toLocaleDateString(
                              "nl-NL",
                            )}
                          </div>

                          {/* Deadline */}
                          {item.deadline && (
                            <div className="mt-2 text-sm text-slate-500">
                              Deadline:{" "}
                              <span className="font-medium text-slate-700">
                                {new Date(item.deadline).toLocaleString(
                                  "nl-NL",
                                  {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  },
                                )}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Right side: buttons */}
                        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                          {/* Overview button */}
                          <Link
                            href={`/teacher/projectplans/${item.id}?tab=overzicht`}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            Overzicht
                          </Link>

                          {/* Projectplannen button */}
                          <Link
                            href={`/teacher/projectplans/${item.id}?tab=projectplannen`}
                            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                          >
                            Projectplannen
                          </Link>

                          {/* Delete button */}
                          <button
                            onClick={() => handleDelete(item.id)}
                            aria-label="Verwijder projectplan"
                            className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-rose-600 transition hover:bg-rose-100"
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
