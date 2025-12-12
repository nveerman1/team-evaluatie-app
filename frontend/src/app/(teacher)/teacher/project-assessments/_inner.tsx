"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import api, { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentListItem, TeamAssessmentStatus } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

type Course = {
  id: number;
  name: string;
};

type AssessmentWithTeams = ProjectAssessmentListItem & {
  teams?: TeamAssessmentStatus[];
};

export default function ProjectAssessmentsListInner() {
  const [data, setData] = useState<AssessmentWithTeams[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");

  // Build courses list from actual assessments data
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

  async function fetchList(courseId?: number, status?: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await projectAssessmentService.getProjectAssessments(
        undefined,
        courseId,
        status === "all" ? undefined : status
      );
      
      // Fetch team overview for each assessment to get team progress
      const itemsWithTeams = await Promise.all(
        (response.items || []).map(async (item) => {
          try {
            const teamOverview = await projectAssessmentService.getTeamOverview(item.id);
            return { ...item, teams: teamOverview.teams };
          } catch (e) {
            console.error(`Failed to load teams for assessment ${item.id}`, e);
            return { ...item, teams: [] };
          }
        })
      );
      
      setData(itemsWithTeams);
    } catch (e: any) {
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
    const status = statusFilter === "all" ? undefined : statusFilter;
    fetchList(courseId, status);
  }, [statusFilter, courseFilter]);

  const handleDelete = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze projectbeoordeling wilt verwijderen?"))
      return;
    try {
      await projectAssessmentService.deleteProjectAssessment(id);
      const courseId = courseFilter === "all" ? undefined : Number(courseFilter);
      const status = statusFilter === "all" ? undefined : statusFilter;
      fetchList(courseId, status);
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
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.course_name && item.course_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.group_name && item.group_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  // Group assessments by course
  const groupedByCourse: Record<string, AssessmentWithTeams[]> = {};
  filteredData.forEach((item) => {
    const courseKey = item.course_name || "Geen vak";
    if (!groupedByCourse[courseKey]) {
      groupedByCourse[courseKey] = [];
    }
    groupedByCourse[courseKey].push(item);
  });

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Projectbeoordeling</h1>
            <p className="text-sm text-slate-500 mt-1">
              Beheer projectbeoordelingen per team met vaste criteria.
            </p>
          </div>
          <Link
            href="/teacher/project-assessments/create"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Nieuwe projectbeoordeling
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
                  placeholder="Zoek op titel, vak of team…"
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
                <option value="published">Gepubliceerd</option>
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
            Geen projectbeoordelingen gevonden.
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
                // Calculate ready teams
                const readyTeams = item.teams?.filter(t => t.status === "completed").length || 0;
                const totalTeams = item.teams?.length || 0;
                const progressPercentage = totalTeams > 0 ? (readyTeams / totalTeams) * 100 : 0;

                // Calculate latest updated_at from teams
                const latestTeamUpdate = item.teams
                  ?.map(t => t.updated_at)
                  .filter((date): date is string => date != null)
                  .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
                
                const displayDate = latestTeamUpdate || item.updated_at;

            return (
              <div
                key={item.id}
                className="group flex items-stretch justify-between gap-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                {/* Left side: content */}
                <div className="flex flex-1 flex-col gap-1">
                  {/* Title + Status pill */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-slate-900">
                      {item.title}
                    </h3>
                    {item.status === "published" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-100">
                        Gepubliceerd
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
                        Concept
                      </span>
                    )}
                  </div>

                  {/* Version */}
                  {item.version && (
                    <div className="text-sm text-slate-600">
                      Versie: {item.version}
                    </div>
                  )}

                  {/* Team progress bar */}
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
                    <div 
                      className="inline-block h-1 w-20 rounded-full bg-slate-200"
                      role="progressbar"
                      aria-valuenow={progressPercentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${readyTeams} van ${totalTeams} teams gereed`}
                    >
                      <div
                        className="block h-1 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                    <span>
                      {readyTeams}/{totalTeams} teams gereed
                    </span>
                  </div>

                  {/* Last updated */}
                  <div className="text-xs text-slate-500">
                    Laatst bijgewerkt: {displayDate ? new Date(displayDate).toLocaleDateString("nl-NL") : "Onbekend"}
                  </div>
                </div>

                {/* Right side: buttons */}
                <div className="flex shrink-0 items-center gap-2">
                  {/* Overview button - hidden on small screens */}
                  <Link
                    href={`/teacher/project-assessments/${item.id}/overview`}
                    className="hidden rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 sm:inline-flex"
                  >
                    Overzicht
                  </Link>

                  {/* Rubric invullen button */}
                  <Link
                    href={`/teacher/project-assessments/${item.id}/edit`}
                    className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    Rubric invullen
                  </Link>

                  {/* Delete button - icon only */}
                  <button
                    onClick={() => handleDelete(item.id)}
                    aria-label="Verwijder projectbeoordeling"
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
