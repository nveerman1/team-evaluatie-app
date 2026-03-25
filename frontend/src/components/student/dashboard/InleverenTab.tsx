"use client";

import React, { useState } from "react";
import { ProjectAssessmentListItem } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { SubmissionDashboardCard } from "./SubmissionDashboardCard";
import { cn } from "@/lib/utils";

type FilterType = "open" | "alles" | "afgerond";

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "alles", label: "Alles" },
  { value: "afgerond", label: "Afgerond" },
];

type InleverenTabProps = {
  projectAssessments: ProjectAssessmentListItem[];
  projectLoading: boolean;
  projectError: string | null;
};

export function InleverenTab({
  projectAssessments,
  projectLoading,
  projectError,
}: InleverenTabProps) {
  const [filter, setFilter] = useState<FilterType>("open");

  // Assessments that belong to a project (have a project_id)
  const withProject = projectAssessments.filter(
    (a) => a.project_id !== null && a.project_id !== undefined,
  );

  // hasSubmitted is a placeholder (always false) – mirrors SubmissionDashboardCard
  // Replace this function with real submission status lookup when available
  const getHasSubmitted = (_assessment: ProjectAssessmentListItem) => false;

  const openCount = withProject.filter((a) => !getHasSubmitted(a)).length;

  const filtered = withProject.filter((a) => {
    const hasSubmitted = getHasSubmitted(a);
    if (filter === "open") return !hasSubmitted;
    if (filter === "afgerond") return hasSubmitted;
    return true;
  });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Card header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Inleveringen</h2>
          <p className="mt-1 text-sm text-slate-500">
            {openCount} open opdrachten, gesorteerd op eerstvolgende deadline.
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition",
                filter === value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Assignment cards */}
      <div className="mt-5 space-y-3">
        {projectLoading ? (
          <Loading />
        ) : projectError ? (
          <ErrorMessage message={projectError} />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-8 text-center">
            <p className="text-slate-500">
              {filter === "afgerond"
                ? "Geen afgeronde opdrachten."
                : "Geen opdrachten beschikbaar om in te leveren."}
            </p>
          </div>
        ) : (
          filtered.map((assessment) => (
            <SubmissionDashboardCard
              key={assessment.id}
              assessment={assessment}
            />
          ))
        )}
      </div>
    </div>
  );
}
