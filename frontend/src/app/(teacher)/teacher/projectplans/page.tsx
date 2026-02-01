"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { projectPlanService } from "@/services/projectplan.service";
import { ProjectPlanListItem, ProjectPlanStatus } from "@/dtos/projectplan.dto";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type StatusFilter = ProjectPlanStatus | "all";

type KPIStats = {
  total: number;
  concept: number;
  ingediend: number;
  go: number;
  noGo: number;
};

function getStatusBadgeClasses(status: ProjectPlanStatus): string {
  switch (status) {
    case "concept":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "ingediend":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "go":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "no-go":
      return "bg-rose-100 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
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
  const [plans, setPlans] = useState<ProjectPlanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    fetchPlans();
  }, [statusFilter]);

  async function fetchPlans() {
    setLoading(true);
    setError(null);
    try {
      const response = await projectPlanService.listProjectPlans({
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setPlans(response.items);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }

  // Calculate KPI stats
  const stats: KPIStats = plans.reduce(
    (acc, plan) => {
      acc.total++;
      if (plan.status === "concept") acc.concept++;
      if (plan.status === "ingediend") acc.ingediend++;
      if (plan.status === "go") acc.go++;
      if (plan.status === "no-go") acc.noGo++;
      return acc;
    },
    { total: 0, concept: 0, ingediend: 0, go: 0, noGo: 0 }
  );

  // Filter by search query
  const filteredPlans = plans.filter((plan) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      plan.project_title.toLowerCase().includes(query) ||
      plan.title?.toLowerCase().includes(query) ||
      plan.team_members.some((member) => member.toLowerCase().includes(query)) ||
      (plan.team_number && plan.team_number.toString().includes(query))
    );
  });

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Projectplannen (GO/NO-GO)
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Overzicht van alle projectplannen en hun status
            </p>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-sm text-slate-500">Totaal</div>
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Concept</div>
            <div className="text-2xl font-bold text-slate-600">{stats.concept}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Ingediend</div>
            <div className="text-2xl font-bold text-blue-600">{stats.ingediend}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">GO</div>
            <div className="text-2xl font-bold text-emerald-600">{stats.go}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">NO-GO</div>
            <div className="text-2xl font-bold text-rose-600">{stats.noGo}</div>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {/* Search field */}
            <div className="relative flex-1">
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
              <Input
                type="text"
                placeholder="Zoek op team, project of teamleden…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status dropdown */}
            <select
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 min-w-[160px]"
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

        {/* Loading / Error / Empty */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="text-slate-500">Laden...</div>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
            Fout: {error}
          </div>
        )}

        {!loading && !error && filteredPlans.length === 0 && (
          <Card className="p-6 text-center text-slate-500">
            Geen projectplannen gevonden.
          </Card>
        )}

        {/* Plans List */}
        {!loading && !error && filteredPlans.length > 0 && (
          <div className="space-y-3">
            {filteredPlans.map((plan) => (
              <Link
                key={plan.id}
                href={`/teacher/projectplans/${plan.id}`}
                className="block"
              >
                <Card className="p-4 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Content */}
                    <div className="flex-1 space-y-2">
                      {/* Title & Status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-slate-900">
                          Team {plan.team_number || "?"} - {plan.project_title}
                        </h3>
                        <Badge
                          className={getStatusBadgeClasses(plan.status)}
                        >
                          {getStatusLabel(plan.status)}
                        </Badge>
                        {plan.locked && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                            🔒 Vergrendeld
                          </Badge>
                        )}
                      </div>

                      {/* Team Members */}
                      <div className="text-sm text-slate-600">
                        {plan.team_members.length > 0 ? (
                          <span>{plan.team_members.join(", ")}</span>
                        ) : (
                          <span className="text-slate-400">Geen teamleden</span>
                        )}
                      </div>

                      {/* Progress */}
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <div className="inline-block h-1.5 w-24 rounded-full bg-slate-200">
                          <div
                            className="block h-1.5 rounded-full bg-blue-500 transition-all"
                            style={{
                              width: `${
                                plan.required_total > 0
                                  ? (plan.required_complete / plan.required_total) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span>
                          {plan.required_complete}/{plan.required_total} verplicht compleet
                        </span>
                      </div>

                      {/* Last Updated */}
                      <div className="text-xs text-slate-400">
                        Laatst bijgewerkt:{" "}
                        {new Date(plan.updated_at).toLocaleDateString("nl-NL", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>

                    {/* Right: Arrow */}
                    <div className="flex items-center text-slate-400">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
