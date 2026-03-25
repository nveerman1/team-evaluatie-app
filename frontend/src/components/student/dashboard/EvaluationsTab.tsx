"use client";

import React, { useState } from "react";
import { StudentEvaluation } from "@/dtos";
import { EvaluationDashboardCard } from "./EvaluationDashboardCard";
import { cn } from "@/lib/utils";

type FilterType = "alles" | "open" | "afgerond" | "gesloten";

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "alles", label: "Alles" },
  { value: "open", label: "Open" },
  { value: "gesloten", label: "Gesloten" },
  { value: "afgerond", label: "Afgerond" },
];

type EvaluationsTabProps = {
  evaluations: StudentEvaluation[];
};

export function EvaluationsTab({ evaluations }: EvaluationsTabProps) {
  const [filter, setFilter] = useState<FilterType>("alles");

  const openCount = evaluations.filter(
    (e) => e.status === "open" && e.progress < 100,
  ).length;

  const filtered = evaluations.filter((e) => {
    const isDone = e.status === "closed" || e.progress === 100;
    if (filter === "open") return !isDone;
    if (filter === "afgerond") return e.progress === 100;
    if (filter === "gesloten") return e.status === "closed";
    return true;
  });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Card header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            360° feedback
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {openCount} open evaluaties, gesorteerd op wat je nu nog moet
            afronden.
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

      {/* Evaluation cards */}
      <div className="mt-5 space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-8 text-center">
            <p className="text-slate-500">
              {filter === "afgerond"
                ? "Geen afgeronde evaluaties."
                : filter === "gesloten"
                  ? "Geen gesloten evaluaties."
                  : filter === "open"
                    ? "Geen open evaluaties op dit moment."
                    : "Geen evaluaties gevonden."}
            </p>
          </div>
        ) : (
          filtered.map((evaluation) => (
            <EvaluationDashboardCard
              key={evaluation.id}
              evaluation={evaluation}
            />
          ))
        )}
      </div>
    </div>
  );
}
