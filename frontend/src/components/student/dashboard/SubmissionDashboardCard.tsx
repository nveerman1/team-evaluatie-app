import React from "react";
import { ProjectAssessmentListItem } from "@/dtos";
import Link from "next/link";

type SubmissionDashboardCardProps = {
  assessment: ProjectAssessmentListItem;
};

export function SubmissionDashboardCard({
  assessment,
}: SubmissionDashboardCardProps) {
  // For now, we don't have submission status in the assessment data
  // This will be enhanced when we fetch actual submission data
  const hasSubmitted = false; // Placeholder

  const formatDeadline = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  const deadline = formatDeadline(assessment.project_end_date);
  const teamLabel = assessment.team_number
    ? `Team ${assessment.team_number}`
    : assessment.group_name || "Onbekend";

  return (
    <Link
      href={`/student/project-assessments/${assessment.id}/submissions`}
      className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-stretch">
        {/* Coloured status bar */}
        <div
          className={`w-1.5 flex-shrink-0 ${
            hasSubmitted ? "bg-emerald-500" : "bg-amber-500"
          }`}
        />

        <div className="flex w-full flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: title, badge, type, tags */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {assessment.title}
              </h3>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                  hasSubmitted
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-amber-50 text-amber-700 ring-amber-200"
                }`}
              >
                {hasSubmitted ? "Ingeleverd" : "Nog inleveren"}
              </span>
            </div>

            <div className="mt-1 text-sm text-slate-500">
              Projectbeoordeling
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1">
                {teamLabel}
              </span>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1">
                {assessment.teacher_name || "Onbekend"}
              </span>
            </div>
          </div>

          {/* Right: deadline block + action button */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
            {deadline && (
              <div className="min-w-[108px] rounded-2xl bg-slate-50 px-4 py-3 text-center ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Deadline
                </div>
                <div className="mt-1 text-base font-semibold text-slate-900">
                  {deadline}
                </div>
              </div>
            )}

            <div className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition group-hover:bg-slate-800">
              {hasSubmitted ? "Bekijken" : "Inleveren"}
              <span className="ml-2">→</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
