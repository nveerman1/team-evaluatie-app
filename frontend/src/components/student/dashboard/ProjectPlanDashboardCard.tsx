import React from "react";
import { Lock } from "lucide-react";
import { ProjectPlanDetail, PlanStatus } from "@/dtos/projectplan.dto";
import Link from "next/link";

type ProjectPlanDashboardCardProps = {
  projectPlan: ProjectPlanDetail;
};

function getStatusInfo(status: PlanStatus, locked: boolean) {
  if (locked || status === PlanStatus.GO) {
    return {
      label: locked ? "GO (Vergrendeld)" : "GO",
      statusClass: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      barClass: "bg-emerald-500",
    };
  }
  switch (status) {
    case PlanStatus.NO_GO:
      return {
        label: "NO-GO",
        statusClass: "bg-rose-50 text-rose-700 ring-rose-200",
        barClass: "bg-rose-500",
      };
    case PlanStatus.INGEDIEND:
      return {
        label: "Ingediend",
        statusClass: "bg-sky-50 text-sky-700 ring-sky-200",
        barClass: "bg-sky-500",
      };
    case PlanStatus.CONCEPT:
    default:
      return {
        label: "Concept",
        statusClass: "bg-amber-50 text-amber-700 ring-amber-200",
        barClass: "bg-amber-500",
      };
  }
}

export function ProjectPlanDashboardCard({ projectPlan }: ProjectPlanDashboardCardProps) {
  const myTeam = projectPlan.teams?.[0];

  if (!myTeam) return null;

  const { label: statusLabel, statusClass, barClass } = getStatusInfo(myTeam.status, myTeam.locked);

  const totalSections = 8;
  const filledSections = myTeam.sections.filter((s) => s.status !== "empty").length;

  return (
    <Link
      href={`/student/projectplans/${myTeam.id}`}
      className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-stretch">
        {/* Coloured status bar */}
        <div className={`w-1.5 flex-shrink-0 ${barClass}`} />

        <div className="flex w-full flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: title, badge, meta info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {projectPlan.project_name}
              </h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClass}`}>
                {statusLabel}
              </span>
              {myTeam.locked && <Lock className="h-3.5 w-3.5 text-emerald-600" />}
            </div>

            {myTeam.title && (
              <div className="mt-1 text-sm text-slate-500">{myTeam.title}</div>
            )}

            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1">
                {myTeam.team_members.join(", ")}
              </span>
            </div>

            {/* Sections progress as text */}
            <div className="mt-3 text-sm text-slate-500">
              {filledSections}/{totalSections} secties ingevuld
            </div>

            {/* Teacher feedback if present */}
            {myTeam.global_teacher_note && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-900 mb-1">Feedback docent:</p>
                <p className="text-xs text-amber-800">{myTeam.global_teacher_note}</p>
              </div>
            )}
          </div>

          {/* Right: progress block + action button */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
            <div className="min-w-[108px] rounded-2xl bg-slate-50 px-4 py-3 text-center ring-1 ring-slate-200">
              <div className="text-xs uppercase tracking-wide text-slate-500">Voortgang</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {filledSections}/{totalSections}
              </div>
            </div>

            <div className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition group-hover:bg-slate-800">
              {myTeam.locked ? "Bekijken" : "Bewerken"}
              <span className="ml-2">→</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
