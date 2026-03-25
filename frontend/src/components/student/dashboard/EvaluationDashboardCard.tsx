import React from "react";
import { StudentEvaluation } from "@/dtos";
import Link from "next/link";

type EvaluationDashboardCardProps = {
  evaluation: StudentEvaluation;
};

export function EvaluationDashboardCard({ evaluation }: EvaluationDashboardCardProps) {
  const isOpen = evaluation.status === "open";
  const isClosed = evaluation.status === "closed";
  const isCompleted = evaluation.progress === 100;

  // Get deadline from evaluation settings
  const reviewDeadline = evaluation.settings?.deadlines?.review || evaluation.deadlines?.review;
  const reflectionDeadline = evaluation.settings?.deadlines?.reflection || evaluation.deadlines?.reflection;
  const deadlineLabel = reviewDeadline || reflectionDeadline || "Geen deadline";

  const peerLabel = `Peer-evaluaties (${evaluation.peersCompleted}/${evaluation.peersTotal})`;

  const actionLabel = isClosed ? "Resultaat" : "Verder";
  const actionHref = isClosed
    ? `/student/evaluation/${evaluation.id}/overzicht`
    : `/student/${evaluation.id}?step=${evaluation.nextStep || 1}`;

  const statusLabel = isCompleted ? "Afgerond" : isOpen ? "Open" : "Gesloten";
  const statusClass = isCompleted
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : isOpen
      ? "bg-sky-50 text-sky-700 ring-sky-200"
      : "bg-slate-100 text-slate-700 ring-slate-200";
  const barClass = isCompleted ? "bg-emerald-500" : isOpen ? "bg-sky-500" : "bg-slate-300";

  const parts = [
    { label: "Zelfbeoordeling", done: evaluation.selfCompleted },
    {
      label: peerLabel,
      done: evaluation.peersCompleted === evaluation.peersTotal && evaluation.peersTotal > 0,
    },
    { label: "Reflectie", done: evaluation.reflectionCompleted },
  ];

  return (
    <Link
      href={actionHref}
      className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-stretch">
        {/* Coloured status bar */}
        <div className={`w-1.5 flex-shrink-0 ${barClass}`} />

        <div className="flex w-full flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: title, badge, type, meta tags, parts */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">{evaluation.title}</h3>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClass}`}
              >
                {statusLabel}
              </span>
            </div>

            <div className="mt-1 text-sm text-slate-500">
              {evaluation.evaluation_type === "peer" ? "Peerevaluatie" : "360° feedback"}
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1">{deadlineLabel}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {parts.map((part) => (
                <span
                  key={part.label}
                  className={part.done ? "text-emerald-700" : "text-slate-500"}
                >
                  {part.done ? "✓" : "○"} {part.label}
                </span>
              ))}
            </div>
          </div>

          {/* Right: deadline block + action button */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
            <div className="min-w-[120px] rounded-2xl bg-slate-50 px-4 py-3 text-center ring-1 ring-slate-200">
              <div className="text-xs uppercase tracking-wide text-slate-500">Deadline</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{deadlineLabel}</div>
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
