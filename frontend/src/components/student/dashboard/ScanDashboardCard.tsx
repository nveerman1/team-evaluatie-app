import React from "react";
import { MessageSquare } from "lucide-react";
import { CompetencyWindow } from "@/dtos";
import Link from "next/link";

type ScanDashboardCardProps = {
  window: CompetencyWindow;
  hasInvites?: boolean;
  onShowInvites?: () => void;
  onInviteExternal?: () => void;
};

export function ScanDashboardCard({
  window,
  hasInvites = false,
  onShowInvites,
  onInviteExternal,
}: ScanDashboardCardProps) {
  const isOpen = window.status === "open";
  const endDate = window.end_date
    ? new Date(window.end_date).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Onbekend";

  const statusLabel = isOpen ? "Open" : "Gesloten";
  const statusClass = isOpen
    ? "bg-sky-50 text-sky-700 ring-sky-200"
    : "bg-slate-100 text-slate-700 ring-slate-200";
  const barClass = isOpen ? "bg-sky-500" : "bg-slate-300";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-stretch">
        {/* Coloured status bar */}
        <div className={`w-1.5 flex-shrink-0 ${barClass}`} />

        <div className="flex w-full flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: title, badge, deadline */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {window.title}
              </h3>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClass}`}
              >
                {statusLabel}
              </span>
            </div>

            <div className="mt-1 text-sm text-slate-500">Competentiescan</div>

            {hasInvites && onShowInvites && (
              <button
                onClick={onShowInvites}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Bekijk uitnodigingen
              </button>
            )}
          </div>

          {/* Right: deadline block + action buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
            <div className="min-w-[108px] rounded-2xl bg-slate-50 px-4 py-3 text-center ring-1 ring-slate-200">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Sluitdatum
              </div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {endDate}
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/student/competency/scan/${window.id}`}
                className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Verder
                <span className="ml-2">→</span>
              </Link>

              {window.require_goal && (
                <Link
                  href={`/student/competency/goal/${window.id}`}
                  className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Leerdoel
                </Link>
              )}
              {window.require_reflection && (
                <Link
                  href={`/student/competency/reflection/${window.id}`}
                  className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Reflectie
                </Link>
              )}
              {hasInvites && onInviteExternal && (
                <button
                  onClick={onInviteExternal}
                  className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Externen
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
