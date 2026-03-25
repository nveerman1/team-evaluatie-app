"use client";

import React, { useState } from "react";
import { ProjectAssessmentListItem } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { ProjectAssessmentDashboardCard } from "./ProjectAssessmentDashboardCard";
import { normalizeProjectAssessmentStatus } from "@/lib/project-assessment-status";
import { cn } from "@/lib/utils";

type FilterType = "alles" | "open" | "gepubliceerd" | "gesloten";

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "alles", label: "Alles" },
  { value: "open", label: "Open" },
  { value: "gepubliceerd", label: "Gepubliceerd" },
  { value: "gesloten", label: "Gesloten" },
];

type BeoordelingTabProps = {
  projectAssessments: ProjectAssessmentListItem[];
  projectLoading: boolean;
  projectError: string | null;
};

export function BeoordelingTab({
  projectAssessments,
  projectLoading,
  projectError,
}: BeoordelingTabProps) {
  const [filter, setFilter] = useState<FilterType>("alles");

  const relevant = (projectAssessments || []).filter((p) =>
    ["open", "published", "closed"].includes(p.status),
  );

  const filtered = relevant.filter((a) => {
    if (filter === "alles") return true;
    const s = normalizeProjectAssessmentStatus(a.status);
    if (filter === "open") return s === "open";
    if (filter === "gepubliceerd") return s === "published";
    if (filter === "gesloten") return s === "published";
    return true;
  });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Card header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Projectbeoordeling
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Beoordelingen per project. Klik door voor rubric, feedback en je
            eindresultaat.
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

      {/* Assessment cards */}
      <div className="mt-5 space-y-3">
        {projectLoading ? (
          <Loading />
        ) : projectError ? (
          <ErrorMessage message={projectError} />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-8 text-center">
            <p className="text-slate-500">
              {filter === "alles"
                ? "Nog geen projectbeoordelingen beschikbaar."
                : `Geen ${filter} beoordelingen gevonden.`}
            </p>
          </div>
        ) : (
          filtered.map((assessment) => (
            <ProjectAssessmentDashboardCard
              key={assessment.id}
              assessment={assessment}
            />
          ))
        )}
      </div>
    </div>
  );
}
