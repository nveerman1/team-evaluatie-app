"use client";

import { useState, useEffect } from "react";
import { projectFeedbackService } from "@/services";
import type { ProjectFeedbackRound } from "@/dtos/project-feedback.dto";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";

export default function StudentProjectFeedbackPage() {
  const [rounds, setRounds] = useState<ProjectFeedbackRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittedIds, setSubmittedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const data = await projectFeedbackService.listStudentRounds();
        setRounds(data);

        // Check which ones the student already submitted
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

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Projectfeedback
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Geef feedback over de projecten waarbij jij betrokken was.
        </p>
      </header>

      {rounds.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-10 text-center text-sm text-gray-500">
          Er zijn momenteel geen openstaande feedbackvragenlijsten voor jou.
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => {
            const done = submittedIds.has(round.id);
            return (
              <div
                key={round.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {round.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {round.question_count} vragen
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {done ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 border border-green-200 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      ✓ Ingevuld
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      Open
                    </span>
                  )}
                  <Link
                    href={`/student/project-feedback/${round.id}`}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm ${
                      done
                        ? "border border-gray-200 text-gray-600 hover:bg-gray-50"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {done ? "Bekijken" : "Invullen"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
