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

// Category definitions matching the default question order
const CATEGORIES = [
  { key: "project", label: "Project", orderRange: [1, 5] },
  { key: "organisatie", label: "Organisatie", orderRange: [6, 10] },
  { key: "begeleiding", label: "Begeleiding", orderRange: [11, 13] },
  { key: "samenwerking", label: "Samenwerking", orderRange: [14, 14] },
  { key: "eindvragen", label: "Eindvragen", orderRange: [15, 17] },
];

function getCategory(order: number) {
  for (const cat of CATEGORIES) {
    if (order >= cat.orderRange[0] && order <= cat.orderRange[1]) return cat.key;
  }
  return "overig";
}

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  const stars = Array.from({ length: max });
  return (
    <span className="inline-flex gap-0.5 text-amber-400 text-lg leading-none">
      {stars.map((_, i) => {
        if (i < full) return <span key={i}>★</span>;
        if (i === full && half) return <span key={i} className="text-amber-200">★</span>;
        return <span key={i} className="text-gray-200">★</span>;
      })}
    </span>
  );
}

function ProgressBar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function DistributionRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600">
      <span className="w-4 text-right font-medium text-gray-500">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-1.5 rounded-full bg-blue-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-gray-400 tabular-nums">{count}×</span>
    </div>
  );
}

function CategorySection({
  label,
  questions,
  open,
  onToggle,
}: {
  label: string;
  questions: ProjectFeedbackResults["questions"];
  open: boolean;
  onToggle: () => void;
}) {
  const ratingQs = questions.filter(
    (q) => q.question_type !== "open" && q.avg_rating != null
  );
  const categoryAvg =
    ratingQs.length > 0
      ? ratingQs.reduce((sum, q) => sum + (q.avg_rating ?? 0), 0) / ratingQs.length
      : null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">{label}</span>
          {categoryAvg != null && (
            <span className="text-xs text-gray-500">gem. {categoryAvg.toFixed(1)}</span>
          )}
        </div>
        <span className="text-gray-400 text-sm">{open ? "▼" : "▶"}</span>
      </button>

      {open && (
        <div className="divide-y divide-gray-100">
          {questions.map((q, i) => (
            <div key={q.id} className="px-4 py-3">
              <p className="text-sm font-medium text-gray-800 mb-2">
                <span className="text-gray-400 mr-1 text-xs">{i + 1}.</span>
                {q.question_text}
              </p>

              {q.question_type !== "open" && q.avg_rating != null && (() => {
                const max = q.question_type === "scale10" ? 10 : 5;
                const dist = q.rating_distribution ?? {};
                const total = Object.values(dist).reduce((a, b) => a + b, 0);
                return (
                  <div className="space-y-1 mt-1">
                    <div className="flex items-center gap-3">
                      <ProgressBar value={q.avg_rating} max={max} />
                      <span className="text-sm font-semibold text-gray-700 w-10 text-right tabular-nums">
                        {q.avg_rating.toFixed(1)}
                      </span>
                    </div>
                    <div className="space-y-0.5 mt-2">
                      {Array.from({ length: max }, (_, k) => k + 1).map((v) => (
                        <DistributionRow
                          key={v}
                          label={String(v)}
                          count={dist[v] ?? 0}
                          total={total}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

              {q.question_type !== "open" && q.avg_rating == null && (
                <p className="text-xs text-gray-400">Nog geen antwoorden</p>
              )}

              {q.question_type === "open" && q.open_answers && q.open_answers.length > 0 && (
                <ul className="space-y-1 mt-1">
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

              {q.question_type === "open" && (!q.open_answers || q.open_answers.length === 0) && (
                <p className="text-xs text-gray-400">Nog geen antwoorden</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function exportToCsv(results: ProjectFeedbackResults, filename: string) {
  const { round, questions } = results;
  const rows: string[][] = [];

  rows.push(["Vraag", "Type", "Gem. score", "Verdeling / Antwoorden"]);

  for (const q of questions) {
    if (q.question_type === "open") {
      const answers = (q.open_answers ?? []).join(" | ");
      rows.push([q.question_text, "open", "", answers]);
    } else {
      const max = q.question_type === "scale10" ? 10 : 5;
      const dist = q.rating_distribution ?? {};
      const distStr = Array.from({ length: max }, (_, i) => i + 1)
        .map((v) => `${v}:${dist[v] ?? 0}`)
        .join("; ");
      rows.push([
        q.question_text,
        q.question_type,
        q.avg_rating != null ? q.avg_rating.toFixed(2) : "",
        distStr,
      ]);
    }
  }

  rows.push([]);
  rows.push([
    "Ronde",
    round.title,
    `Respons: ${round.response_count}/${round.total_students}`,
    `Status: ${round.status}`,
  ]);

  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProjectFeedbackDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const roundId = Number(id);

  const [results, setResults] = useState<ProjectFeedbackResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(["project"]));

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

  function toggleCategory(key: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!results) return null;

  const { round, questions, response_rate } = results;
  const statusInfo = STATUS_LABELS[round.status] ?? STATUS_LABELS.draft;
  const responseLabel = `${round.response_count} / ${round.total_students} ingevuld`;

  // Derive overview metrics
  const gradeQuestion = questions.find((q) => q.question_type === "scale10");
  const recommendQuestion = questions.find(
    (q) => q.question_type === "rating" && q.order === 16
  );

  // Group questions by category
  const byCategory: Record<string, typeof questions> = {};
  for (const q of questions) {
    const cat = getCategory(q.order);
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(q);
  }

  const categoriesToShow = [
    ...CATEGORIES.filter((c) => byCategory[c.key]?.length),
    ...(byCategory["overig"]?.length
      ? [{ key: "overig", label: "Overig", orderRange: [0, 0] }]
      : []),
  ];

  // Per-category averages (rating questions only)
  const categoryAvgs = categoriesToShow
    .map((cat) => {
      const qs = (byCategory[cat.key] ?? []).filter(
        (q) => q.question_type !== "open" && q.avg_rating != null
      );
      if (qs.length === 0) return null;
      const avg = qs.reduce((s, q) => s + (q.avg_rating ?? 0), 0) / qs.length;
      return { label: cat.label, avg };
    })
    .filter(Boolean) as { label: string; avg: number }[];

  return (
    <>
      {/* Page header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-5 max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/teacher/projects" className="text-xs text-gray-400 hover:text-gray-600">
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
          <div className="flex flex-wrap gap-2 items-center">
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
              onClick={() =>
                exportToCsv(
                  results,
                  `projectfeedback-${round.title.toLowerCase().replace(/\s+/g, "-")}.csv`
                )
              }
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1"
            >
              📥 Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1"
            >
              🖨️ Afdrukken
            </button>
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
        {/* ─── OVERZICHT ─── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
            Overzicht
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Project grade */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Projectcijfer
                </span>
                {gradeQuestion?.avg_rating != null ? (
                  <div className="flex items-end gap-1 mt-1">
                    <span className="text-4xl font-bold text-gray-900">
                      {gradeQuestion.avg_rating.toFixed(1)}
                    </span>
                    <span className="text-sm text-gray-400 mb-1">/ 10</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 mt-1">—</span>
                )}
              </div>

              {/* Recommendation */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Aanbevelen
                </span>
                {recommendQuestion?.avg_rating != null ? (
                  <>
                    <StarRating value={recommendQuestion.avg_rating} />
                    <span className="text-sm text-gray-600">
                      {recommendQuestion.avg_rating.toFixed(1)} / 5
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-gray-400 mt-1">—</span>
                )}
              </div>

              {/* Fill rate */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Invulpercentage
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-2.5 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(response_rate, 100)}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold text-gray-900 tabular-nums">
                    {response_rate.toFixed(0)}%
                  </span>
                </div>
                <span className="text-xs text-gray-500">{responseLabel}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── PER CATEGORIE ─── */}
        {categoryAvgs.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Per categorie
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-3">
              {categoryAvgs.map(({ label, avg }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm font-medium text-gray-700">
                    {label}
                  </span>
                  <ProgressBar value={avg} max={5} color="bg-blue-500" />
                  <span className="w-8 text-sm font-semibold text-gray-700 text-right tabular-nums">
                    {avg.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── PER VRAAG ─── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
            Per vraag
          </h2>
          <div className="space-y-2">
            {categoriesToShow.map((cat) => (
              <CategorySection
                key={cat.key}
                label={cat.label}
                questions={byCategory[cat.key] ?? []}
                open={openCategories.has(cat.key)}
                onToggle={() => toggleCategory(cat.key)}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

