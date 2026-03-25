"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { projectFeedbackService } from "@/services";
import type { ProjectFeedbackResults } from "@/dtos/project-feedback.dto";
import { ApiAuthError } from "@/lib/api";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Concept",
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
  open: {
    label: "Open",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  closed: {
    label: "Gesloten",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
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
    if (order >= cat.orderRange[0] && order <= cat.orderRange[1])
      return cat.key;
  }
  return "overig";
}

// Likert color palette (scale 1–5)
const LIKERT_COLORS: Record<number, string> = {
  1: "bg-red-600",
  2: "bg-rose-400",
  3: "bg-orange-500",
  4: "bg-lime-500",
  5: "bg-green-600",
};

const SCALE10_COLORS: Record<number, string> = {
  1: "bg-red-600",
  2: "bg-red-500",
  3: "bg-rose-400",
  4: "bg-orange-400",
  5: "bg-amber-400",
  6: "bg-yellow-400",
  7: "bg-lime-400",
  8: "bg-green-400",
  9: "bg-green-500",
  10: "bg-emerald-600",
};

/** Maps a 1–5 average to the matching Likert color class */
function likertColorForAvg(avg: number): string {
  if (avg >= 4.5) return LIKERT_COLORS[5];
  if (avg >= 3.5) return LIKERT_COLORS[4];
  if (avg >= 2.5) return LIKERT_COLORS[3];
  if (avg >= 1.5) return LIKERT_COLORS[2];
  return LIKERT_COLORS[1];
}

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  const stars = Array.from({ length: max });
  return (
    <span className="inline-flex gap-0.5 text-amber-400 text-lg leading-none">
      {stars.map((_, i) => {
        if (i < full) return <span key={i}>★</span>;
        if (i === full && half)
          return (
            <span key={i} className="text-amber-200">
              ★
            </span>
          );
        return (
          <span key={i} className="text-gray-200">
            ★
          </span>
        );
      })}
    </span>
  );
}

function ProgressBar({
  value,
  max,
  color = "bg-blue-500",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
      <div
        className={`h-2 rounded-full ${color} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Single stacked horizontal Likert bar (no per-question legend). */
function LikertBar({
  distribution,
  max,
  avg,
}: {
  distribution: Record<number, number>;
  max: number;
  avg: number | null;
}) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  const colors = max === 10 ? SCALE10_COLORS : LIKERT_COLORS;
  const scores = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div className="flex items-center gap-2 mt-1">
      {/* Stacked bar */}
      <div className="flex-1 h-5 rounded-md overflow-hidden flex">
        {total === 0 ? (
          <div className="w-full h-full bg-gray-100 rounded-md" />
        ) : (
          scores.map((v) => {
            const count = distribution[v] ?? 0;
            const pct = (count / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={v}
                title={`${v}: ${count}×`}
                className={`${colors[v] ?? "bg-gray-300"} h-full flex items-center justify-center transition-all`}
                style={{ width: `${pct}%` }}
              >
                {pct >= 8 && (
                  <span className="text-[10px] font-semibold text-white/90 leading-none select-none">
                    {count}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
      {/* Average */}
      {avg != null && (
        <span className="text-sm font-semibold text-gray-700 w-14 text-right tabular-nums shrink-0">
          gem.&nbsp;{avg.toFixed(1)}
        </span>
      )}
    </div>
  );
}

/** Shared Likert legend shown once below all stacked bars. */
function LikertLegend() {
  const items = [
    { score: 1, label: "Helemaal oneens" },
    { score: 2, label: "Oneens" },
    { score: 3, label: "Neutraal" },
    { score: 4, label: "Eens" },
    { score: 5, label: "Helemaal eens" },
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3 border-t border-gray-100">
      {items.map(({ score, label }) => (
        <span
          key={score}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500"
        >
          <span
            className={`inline-block w-3 h-3 rounded-sm shrink-0 ${LIKERT_COLORS[score]}`}
          />
          <span className="font-medium text-gray-600">{score}</span>
          <span>– {label}</span>
        </span>
      ))}
    </div>
  );
}

/** Summary card shown below the category pill tabs. */
function CategorySummaryCard({
  label,
  avg,
}: {
  label: string;
  avg: number | null;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-5">
      <div className="shrink-0 text-center min-w-[3.5rem]">
        {avg != null ? (
          <>
            <span className="text-3xl font-bold text-gray-900 tabular-nums leading-none">
              {avg.toFixed(1)}
            </span>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
              gemiddelde score
            </p>
          </>
        ) : (
          <span className="text-lg text-gray-400">—</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{label}</p>
        <p className="text-xs text-gray-400">schaal 1 tot 5</p>
        {avg != null && (
          <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${likertColorForAvg(avg)}`}
              style={{ width: `${((avg - 1) / 4) * 100}%` }}
            />
          </div>
        )}
      </div>
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
  const [activeCategoryKey, setActiveCategoryKey] = useState<string | null>(
    null,
  );

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
    if (!confirm("Weet je zeker dat je deze feedbackronde wilt verwijderen?"))
      return;
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

  // Derive overview metrics
  const gradeQuestion = questions.find((q) => q.question_type === "scale10");
  const recommendQuestion = questions.find(
    (q) => q.question_type === "rating" && q.order === 16,
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

  // Per-category averages (rating questions only; skip "eindvragen" — mixed scales)
  const categoryAvgs = categoriesToShow
    .filter((cat) => cat.key !== "eindvragen")
    .map((cat) => {
      const qs = (byCategory[cat.key] ?? []).filter(
        (q) => q.question_type !== "open" && q.avg_rating != null,
      );
      if (qs.length === 0) return null;
      const avg = qs.reduce((s, q) => s + (q.avg_rating ?? 0), 0) / qs.length;
      return { label: cat.label, avg };
    })
    .filter(Boolean) as { label: string; avg: number }[];

  // Active category for pill tabs — default to first available
  const firstCategoryKey = categoriesToShow[0]?.key ?? null;
  const currentKey = activeCategoryKey ?? firstCategoryKey;
  const activeCategory =
    categoriesToShow.find((c) => c.key === currentKey) ?? categoriesToShow[0];
  const activeCatQuestions = activeCategory
    ? (byCategory[activeCategory.key] ?? [])
    : [];
  const activeCatRatingQs = activeCatQuestions.filter(
    (q) => q.question_type !== "open" && q.question_type !== "scale10",
  );
  const activeCatScale10Qs = activeCatQuestions.filter(
    (q) => q.question_type === "scale10",
  );
  const activeCatOpenQs = activeCatQuestions.filter(
    (q) => q.question_type === "open",
  );
  const activeCatAvg =
    activeCatRatingQs.length > 0
      ? activeCatRatingQs.reduce((s, q) => s + (q.avg_rating ?? 0), 0) /
        activeCatRatingQs.length
      : null;

  return (
    <>
      {/* Page header */}
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
          <div className="flex flex-wrap gap-2 items-center">
            {/* Status toggle — pill group: Concept | Open | Gesloten */}
            <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button
                type="button"
                disabled={actionLoading || round.status === "draft"}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  round.status === "draft"
                    ? "bg-gray-700 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50 disabled:cursor-default"
                }`}
              >
                Concept
              </button>
              <button
                type="button"
                disabled={
                  actionLoading ||
                  round.status === "open" ||
                  round.status === "closed"
                }
                onClick={round.status === "draft" ? handleOpen : undefined}
                className={`px-3 py-1.5 font-medium border-x border-gray-200 transition-colors ${
                  round.status === "open"
                    ? "bg-green-600 text-white"
                    : round.status === "closed"
                      ? "bg-white text-gray-400 cursor-default"
                      : "bg-white text-gray-600 hover:bg-green-50 hover:text-green-700"
                }`}
              >
                {actionLoading && round.status === "draft" ? "…" : "Open"}
              </button>
              <button
                type="button"
                disabled={
                  actionLoading ||
                  round.status === "closed" ||
                  round.status === "draft"
                }
                onClick={round.status === "open" ? handleClose : undefined}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  round.status === "closed"
                    ? "bg-slate-600 text-white"
                    : round.status === "draft"
                      ? "bg-white text-gray-300 cursor-default"
                      : "bg-white text-gray-600 hover:bg-slate-100"
                }`}
              >
                {actionLoading && round.status === "open" ? "…" : "Gesloten"}
              </button>
            </div>
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
                  <ProgressBar
                    value={avg}
                    max={5}
                    color={likertColorForAvg(avg)}
                  />
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Category pill tabs */}
            <div className="px-4 pt-4 pb-0 flex flex-wrap gap-2 border-b border-gray-100">
              {categoriesToShow.map((cat) => {
                const isActive =
                  cat.key === (activeCategoryKey ?? firstCategoryKey);
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategoryKey(cat.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors mb-3 ${
                      isActive
                        ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {activeCategory && (
              <div className="p-4 space-y-4">
                {/* Category summary card (only for scale-5 categories with a meaningful avg) */}
                {activeCatAvg != null && (
                  <CategorySummaryCard
                    label={activeCategory.label}
                    avg={activeCatAvg}
                  />
                )}

                {/* Scale-5 Likert questions */}
                {activeCatRatingQs.length > 0 && (
                  <div className="space-y-4">
                    {activeCatRatingQs.map((q, i) => (
                      <div key={q.id}>
                        <p className="text-sm font-medium text-gray-800">
                          <span className="text-gray-400 mr-1 text-xs">
                            {i + 1}.
                          </span>
                          {q.question_text}
                        </p>
                        {q.avg_rating != null ? (
                          <LikertBar
                            distribution={q.rating_distribution ?? {}}
                            max={5}
                            avg={q.avg_rating}
                          />
                        ) : (
                          <p className="text-xs text-gray-400 mt-1">
                            Nog geen antwoorden
                          </p>
                        )}
                      </div>
                    ))}
                    {/* One shared legend below all Likert bars */}
                    <LikertLegend />
                  </div>
                )}

                {/* Scale-10 questions (separate block, no Likert legend) */}
                {activeCatScale10Qs.length > 0 && (
                  <div className="space-y-4 pt-2">
                    {activeCatScale10Qs.map((q, i) => (
                      <div key={q.id}>
                        <p className="text-sm font-medium text-gray-800">
                          <span className="text-gray-400 mr-1 text-xs">
                            {activeCatRatingQs.length + i + 1}.
                          </span>
                          {q.question_text}
                        </p>
                        {q.avg_rating != null ? (
                          <LikertBar
                            distribution={q.rating_distribution ?? {}}
                            max={10}
                            avg={q.avg_rating}
                          />
                        ) : (
                          <p className="text-xs text-gray-400 mt-1">
                            Nog geen antwoorden
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* No scored questions empty state */}
                {activeCatRatingQs.length === 0 &&
                  activeCatScale10Qs.length === 0 && (
                    <p className="text-sm text-gray-400">
                      Geen scorevragen in deze categorie.
                    </p>
                  )}

                {/* Open answers */}
                {activeCatOpenQs.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                      Open antwoorden
                    </p>
                    {activeCatOpenQs.map((q) => (
                      <div key={q.id}>
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          {q.question_text}
                        </p>
                        {q.open_answers && q.open_answers.length > 0 ? (
                          <ul className="space-y-1">
                            {q.open_answers.map((ans, j) => (
                              <li
                                key={j}
                                className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-700"
                              >
                                {ans}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-gray-400">
                            Nog geen antwoorden
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
