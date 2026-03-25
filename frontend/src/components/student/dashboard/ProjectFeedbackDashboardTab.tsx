"use client";

import { useState, useEffect } from "react";
import { projectFeedbackService } from "@/services";
import type { ProjectFeedbackRound } from "@/dtos/project-feedback.dto";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";

export function ProjectFeedbackDashboardTab() {
  const [rounds, setRounds] = useState<ProjectFeedbackRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittedIds, setSubmittedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const data = await projectFeedbackService.listStudentRounds();
        setRounds(data);

        const checked = await Promise.all(
          data.map(async (r) => {
            try {
              const resp = await projectFeedbackService.getMyResponse(r.id);
              return resp.submitted_at ? r.id : null;
            } catch {
              return null;
            }
          }),
        );
        setSubmittedIds(new Set(checked.filter(Boolean) as number[]));
      } catch (e: any) {
        setError(e?.message || "Laden mislukt");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  const openCount = rounds.filter((r) => !submittedIds.has(r.id)).length;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Card header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Projectevaluatie
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {openCount} open {openCount === 1 ? "evaluatie" : "evaluaties"} —
            geef feedback over de projecten waarbij jij betrokken was.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {rounds.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-8 text-center">
            <p className="text-slate-500">
              Er zijn momenteel geen openstaande feedbackvragenlijsten voor jou.
            </p>
          </div>
        ) : (
          rounds.map((round) => {
            const done = submittedIds.has(round.id);
            const statusLabel = done ? "Ingevuld" : "Open";
            const statusClass = done
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-sky-50 text-sky-700 ring-sky-200";
            const barClass = done ? "bg-emerald-500" : "bg-sky-500";

            return (
              <Link
                key={round.id}
                href={`/student/project-feedback/${round.id}`}
                className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-stretch">
                  <div className={`w-1.5 flex-shrink-0 ${barClass}`} />

                  <div className="flex w-full flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">
                          {round.title}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      {round.course_name && (
                        <div className="mt-1 text-sm text-slate-500">
                          {round.course_name}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1">
                          {round.question_count} vragen
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
                      <div className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition group-hover:bg-slate-800">
                        {done ? "Bekijken" : "Invullen"}
                        <span className="ml-2">→</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
