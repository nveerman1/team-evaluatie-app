import React from "react";
import { ProjectAssessmentListItem } from "@/dtos";
import Link from "next/link";
import { normalizeProjectAssessmentStatus } from "@/lib/project-assessment-status";

type ProjectAssessmentDashboardCardProps = {
  assessment: ProjectAssessmentListItem;
};

export function ProjectAssessmentDashboardCard({ 
  assessment 
}: ProjectAssessmentDashboardCardProps) {
  const status = normalizeProjectAssessmentStatus(assessment.status);
  const isPublished = status === "published";
  const isOpen = status === "open";

  const grade = (assessment.metadata_json as any)?.final_grade || (assessment.metadata_json as any)?.suggested_grade;
  const teamLabel = assessment.group_name || (assessment.team_number ? `Team ${assessment.team_number}` : "Onbekend");

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  const publishedDate = formatDate(assessment.published_at);

  const statusLabel = isPublished ? "Gepubliceerd" : isOpen ? "Open" : "Gesloten";
  const statusClass = isPublished
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : isOpen
      ? "bg-sky-50 text-sky-700 ring-sky-200"
      : "bg-slate-100 text-slate-700 ring-slate-200";
  const barClass = isPublished ? "bg-emerald-500" : isOpen ? "bg-sky-500" : "bg-slate-300";

  const actionLabel = isPublished ? "Bekijken" : "Zelfbeoordeling";
  const actionHref = isPublished
    ? `/student/project-assessments/${assessment.id}`
    : `/student/project-assessments/${assessment.id}/self`;

  return (
    <Link
      href={actionHref}
      className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-stretch">
        {/* Coloured status bar */}
        <div className={`w-1.5 flex-shrink-0 ${barClass}`} />

        <div className="flex w-full flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: title, badge, meta tags */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">{assessment.title}</h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClass}`}>
                {statusLabel}
              </span>
              {grade && (
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
                  Cijfer: {grade.toFixed(1)}
                </span>
              )}
            </div>

            <div className="mt-1 text-sm text-slate-500">Projectbeoordeling</div>

            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1">{teamLabel}</span>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1">
                {assessment.teacher_name || "Onbekend"}
              </span>
            </div>
          </div>

          {/* Right: info block + action button */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
            <div className="min-w-[120px] rounded-2xl bg-slate-50 px-4 py-3 text-center ring-1 ring-slate-200">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {isPublished ? "Gepubliceerd" : "Status"}
              </div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {isPublished && publishedDate ? publishedDate : statusLabel}
              </div>
            </div>

            <div className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition group-hover:bg-slate-800">
              {actionLabel}
              <span className="ml-2">→</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
