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
          })
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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Projectfeedback</h2>
        <p className="text-sm text-slate-600 mt-0.5">
          Geef feedback over de projecten waarbij jij betrokken was.
        </p>
      </div>

      {rounds.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500 shadow-sm">
          Er zijn momenteel geen openstaande feedbackvragenlijsten voor jou.
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => {
            const done = submittedIds.has(round.id);
            return (
              <div
                key={round.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {round.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {round.question_count} vragen
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {done ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 border border-green-200 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      ✓ Ingevuld
                    </span>
                  ) : (
                    <Link
                      href={`/student/project-feedback/${round.id}`}
                      className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      Invullen →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
