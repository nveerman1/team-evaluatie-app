"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { projectFeedbackService } from "@/services";
import type { ProjectFeedbackResults } from "@/dtos/project-feedback.dto";
import { ApiAuthError } from "@/lib/api";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Concept", className: "bg-gray-100 text-gray-700 border-gray-200" },
  open: { label: "Open", className: "bg-green-100 text-green-700 border-green-200" },
  closed: { label: "Gesloten", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

function StarBar({ avg, max = 5 }: { avg: number; max?: number }) {
  const pct = (avg / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-2 rounded-full bg-blue-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right">
        {avg.toFixed(1)}
      </span>
    </div>
  );
}

function DistributionBar({ distribution, max }: { distribution: Record<number, number>; max: number }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const steps = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <div className="space-y-1 mt-2">
      {steps.map((v) => {
        const count = distribution[v] ?? 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={v} className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-4 text-right font-medium">{v}</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-blue-400"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-gray-400">{count}×</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ProjectFeedbackDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const roundId = Number(id);

  const [results, setResults] = useState<ProjectFeedbackResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function loadResults() {
    setLoading(true);
    setError(null);
    try {
      const data = await projectFeedbackService.getResults(roundId);
      setResults(data);
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  async function handleOpen() {
    setActionLoading(true);
    try {
      await projectFeedbackService.openRound(roundId);
      await loadResults();
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Mislukt");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClose() {
    if (!confirm("Weet je zeker dat je de feedbackronde wilt sluiten?")) return;
    setActionLoading(true);
    try {
      await projectFeedbackService.closeRound(roundId);
      await loadResults();
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Mislukt");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Weet je zeker dat je deze feedbackronde wilt verwijderen?")) return;
    try {
      await projectFeedbackService.deleteRound(roundId);
      router.push("/teacher/projects");
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Verwijderen mislukt");
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!results) return null;

  const { round, questions, response_rate } = results;
  const statusInfo = STATUS_LABELS[round.status] ?? STATUS_LABELS.draft;
  const responseLabel = `${round.response_count} / ${round.total_students} ingevuld`;

  return (
    <>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-5 max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/teacher/projects"
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ← Projecten
              </Link>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
              {round.title}
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
              >
                {statusInfo.label}
              </span>
            </h1>
          </div>
          <div className="flex gap-2">
            {round.status === "draft" && (
              <button
                onClick={handleOpen}
                disabled={actionLoading}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-60"
              >
                Openstellen voor leerlingen
              </button>
            )}
            {round.status === "open" && (
              <button
                onClick={handleClose}
                disabled={actionLoading}
                className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-60"
              >
                Sluiten
              </button>
            )}
            <button
              onClick={handleDelete}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Verwijderen
            </button>
          </div>
        </header>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Response rate card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Respons</p>
              <p className="text-xs text-gray-500">{responseLabel}</p>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {response_rate.toFixed(0)}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-2.5 rounded-full bg-blue-500 transition-all"
              style={{ width: `${Math.min(response_rate, 100)}%` }}
            />
          </div>
          {round.avg_rating && (
            <p className="text-xs text-gray-500 mt-2">
              Gemiddelde score (alle Likert-vragen):{" "}
              <span className="font-semibold text-gray-800">{round.avg_rating.toFixed(1)} / 5</span>
            </p>
          )}
        </div>

        {/* Question results */}
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div
              key={q.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-medium text-gray-900">
                  <span className="text-gray-400 mr-1">{i + 1}.</span>
                  {q.question_text}
                </p>
                <span className="shrink-0 text-[11px] font-medium text-gray-400">
                  {q.question_type === "open"
                    ? "open"
                    : q.question_type === "scale10"
                    ? "1–10"
                    : "1–5"}
                </span>
              </div>

              {q.question_type !== "open" && q.avg_rating != null && (
                <div className="space-y-1">
                  <StarBar
                    avg={q.avg_rating}
                    max={q.question_type === "scale10" ? 10 : 5}
                  />
                  {q.rating_distribution && (
                    <DistributionBar
                      distribution={q.rating_distribution}
                      max={q.question_type === "scale10" ? 10 : 5}
                    />
                  )}
                </div>
              )}

              {q.question_type === "open" && q.open_answers && q.open_answers.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {q.open_answers.map((ans, j) => (
                    <li
                      key={j}
                      className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-700"
                    >
                      {ans}
                    </li>
                  ))}
                </ul>
              )}

              {q.question_type !== "open" && q.avg_rating == null && (
                <p className="text-xs text-gray-400">Nog geen antwoorden</p>
              )}

              {q.question_type === "open" && (!q.open_answers || q.open_answers.length === 0) && (
                <p className="text-xs text-gray-400">Nog geen antwoorden</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
