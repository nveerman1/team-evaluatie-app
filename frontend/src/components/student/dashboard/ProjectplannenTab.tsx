import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ChevronRight, Lock } from "lucide-react";
import { ProjectPlanListItem, ProjectPlanStatus } from "@/dtos/projectplan.dto";
import { projectPlanService } from "@/services/projectplan.service";
import Link from "next/link";
import { Loading, ErrorMessage } from "@/components";

function getStatusBadgeClasses(status: ProjectPlanStatus): string {
  switch (status) {
    case "concept":
      return "rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-200";
    case "ingediend":
      return "rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-100";
    case "go":
      return "rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
    case "no-go":
      return "rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-100";
    default:
      return "rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-200";
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

type ProjectplannenTabProps = {
  // No props needed
};

export function ProjectplannenTab({}: ProjectplannenTabProps = {}) {
  const [plans, setPlans] = useState<ProjectPlanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    setLoading(true);
    setError(null);
    try {
      const data = await projectPlanService.listMyProjectPlans();
      setPlans(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }

  // No filtering needed anymore
  const filteredPlans = plans;

  if (loading) {
    return (
      <div className="p-6">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorMessage message={`Fout: ${error}`} />
      </div>
    );
  }

  if (filteredPlans.length === 0) {
    return (
      <Card className="rounded-2xl border-slate-200 bg-slate-50">
        <CardContent className="p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <p className="text-slate-600">
            Je hebt nog geen projectplannen.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Intro card */}
      <Card className="rounded-2xl border-slate-200 bg-slate-50">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-slate-600 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="text-sm text-slate-700">
                <span className="font-semibold">{filteredPlans.length}</span>{" "}
                {filteredPlans.length === 1 ? "projectplan" : "projectplannen"}
              </p>
              <p className="text-xs text-slate-500">
                Vul je projectplan in voor GO/NO-GO beoordeling.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plans list */}
      {filteredPlans.map((plan) => {
        const progressPercentage =
          plan.required_total > 0
            ? (plan.required_complete / plan.required_total) * 100
            : 0;

        return (
          <Link
            key={plan.id}
            href={`/student/projects/${plan.project_id}/projectplan`}
          >
            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer">
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {plan.project_title}
                      </h3>
                      <Badge className={getStatusBadgeClasses(plan.status)}>
                        {getStatusLabel(plan.status)}
                      </Badge>
                      {plan.locked && (
                        <Badge className="rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                          <Lock className="h-3 w-3 mr-1" />
                          Vergrendeld
                        </Badge>
                      )}
                    </div>

                    {plan.course_name && (
                      <div className="text-sm text-slate-600">
                        {plan.course_name}
                      </div>
                    )}

                    {/* Progress bar */}
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <div className="inline-block h-2 w-24 rounded-full bg-slate-200">
                        <div
                          className="block h-2 rounded-full bg-blue-500 transition-all"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                      <span className="text-xs">
                        {plan.required_complete}/{plan.required_total} verplicht
                      </span>
                    </div>

                    <div className="text-xs text-slate-400">
                      Laatst bijgewerkt:{" "}
                      {new Date(plan.updated_at).toLocaleDateString("nl-NL")}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center">
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
