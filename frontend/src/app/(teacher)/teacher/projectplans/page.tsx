"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { projectPlanService } from "@/services/projectplan.service";
import { ProjectPlanListItem, ProjectPlanStatus } from "@/dtos/projectplan.dto";
import { Loading, ErrorMessage } from "@/components";

type Course = {
  id: number;
  name: string;
};

type StatusFilter = ProjectPlanStatus | "all";

function getStatusBadgeClasses(status: ProjectPlanStatus): string {
  switch (status) {
    case "concept":
      return "inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10";
    case "ingediend":
      return "inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10";
    case "go":
      return "inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20";
    case "no-go":
      return "inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10";
    default:
      return "inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10";
  }
}

function getStatusLabel(status: ProjectPlanStatus): string {
  switch (status) {
    case "concept":
      return "Concept";
    case "ingediend":
      return "Ingediend";
    case "go":
      return "GO";
    case "no-go":
      return "NO-GO";
    default:
      return status;
  }
}

export default function ProjectPlansListPage() {
  const [data, setData] = useState<ProjectPlanListItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");

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

  async function fetchList(courseId?: number, status?: StatusFilter) {
    setLoading(true);
    setError(null);
    try {
      const response = await projectPlanService.listProjectPlans({
        course_id: courseId,
        status: status === "all" ? undefined : status,
      });
      setData(response.items || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const courseId = courseFilter === "all" ? undefined : Number(courseFilter);
    fetchList(courseId, statusFilter);
  }, [statusFilter, courseFilter]);

  // Filter data by search query
  const filteredData = data.filter((item) => {
    const matchesSearch =
      searchQuery === "" ||
      item.project_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.title && item.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.course_name && item.course_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.team_members.some((member) => member.toLowerCase().includes(searchQuery.toLowerCase()));
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

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Projectplan</h1>
            <p className="text-sm text-slate-500 mt-1">
              Overzicht van projectplannen (GO/NO-GO) per vak.
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
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">Alle statussen</option>
                <option value="concept">Concept</option>
                <option value="ingediend">Ingediend</option>
                <option value="go">GO</option>
                <option value="no-go">NO-GO</option>
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
                  const progressPercentage =
                    item.required_total > 0
                      ? (item.required_complete / item.required_total) * 100
                      : 0;

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
                            Team {item.team_number || "?"} - {item.project_title}
                          </h3>
                          <span className={getStatusBadgeClasses(item.status)}>
                            {getStatusLabel(item.status)}
                          </span>
                          {item.locked && (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                              🔒 Vergrendeld
                            </span>
                          )}
                        </div>

                        {/* Team members */}
                        <div className="text-sm text-slate-600">
                          {item.team_members.length > 0 ? (
                            <span>{item.team_members.join(", ")}</span>
                          ) : (
                            <span className="text-slate-400">Geen teamleden</span>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
                          <div
                            className="inline-block h-1 w-20 rounded-full bg-slate-200"
                            role="progressbar"
                            aria-valuenow={progressPercentage}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${item.required_complete} van ${item.required_total} verplicht compleet`}
                          >
                            <div
                              className="block h-1 rounded-full bg-blue-500 transition-all"
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                          <span>
                            {item.required_complete}/{item.required_total} verplicht compleet
                          </span>
                        </div>

                        {/* Last updated */}
                        <div className="text-xs text-slate-500">
                          Laatst bijgewerkt:{" "}
                          {new Date(item.updated_at).toLocaleDateString("nl-NL")}
                        </div>
                      </div>

                      {/* Right side: buttons */}
                      <div className="flex shrink-0 items-center gap-2">
                        {/* View button */}
                        <Link
                          href={`/teacher/projectplans/${item.id}`}
                          className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                        >
                          Bekijken
                        </Link>
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
