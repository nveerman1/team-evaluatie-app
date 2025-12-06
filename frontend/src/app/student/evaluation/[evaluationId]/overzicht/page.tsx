"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loading, ErrorMessage } from "@/components";
import { FeedbackSummary } from "@/components/student";
import { peerFeedbackResultsService } from "@/services";
import type { EvaluationResult, OmzaKey } from "@/dtos";
import {
  OMZA_LABELS,
  mean,
  round1,
  getOmzaEmoji,
  getOmzaEmojiColorClasses,
  formatDelta,
  getTeamContributionFactor,
  getTeamContributionLabel,
} from "@/components/student/peer-results/helpers";

export default function OverzichtPage() {
  const params = useParams();
  const router = useRouter();
  const evaluationId = Number(params.evaluationId);

  const [evaluationData, setEvaluationData] = useState<EvaluationResult | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load peer feedback results for this evaluation
  useEffect(() => {
    if (!evaluationId) return;

    setLoading(true);
    setError(null);
    
    peerFeedbackResultsService
      .getMyPeerResults()
      .then((results) => {
        // Find the evaluation with matching ID
        const evalData = results.find((r) => r.id === String(evaluationId));
        if (evalData) {
          setEvaluationData(evalData);
        } else {
          setError("Evaluatie niet gevonden");
        }
      })
      .catch((e) => {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      })
      .finally(() => setLoading(false));
  }, [evaluationId]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!evaluationData) {
    return <ErrorMessage message="Evaluatie niet gevonden" />;
  }

  // Calculate OMZA averages from peer data
  const averages = useMemo(() => {
    const obj: Record<OmzaKey, number> = {
      organiseren: 0,
      meedoen: 0,
      zelfvertrouwen: 0,
      autonomie: 0,
    };
    (Object.keys(obj) as OmzaKey[]).forEach((k) => {
      const list = evaluationData.peers.map((p) => p.scores[k]).filter(Boolean);
      obj[k] = round1(mean(list));
    });
    return obj;
  }, [evaluationData]);

  const teamContributionFactor = getTeamContributionFactor(
    evaluationData.teamContributionFactor,
    evaluationData.gcfScore
  );

  const teamContributionLabel =
    evaluationData.teamContributionLabel ??
    (teamContributionFactor !== undefined
      ? getTeamContributionLabel(teamContributionFactor)
      : undefined);

  // Use omzaAverages if provided, otherwise calculate from peers
  const omzaAverages = evaluationData.omzaAverages ?? [
    { key: "O", label: OMZA_LABELS.organiseren, value: averages.organiseren, delta: 0 },
    { key: "M", label: OMZA_LABELS.meedoen, value: averages.meedoen, delta: 0 },
    { key: "Z", label: OMZA_LABELS.zelfvertrouwen, value: averages.zelfvertrouwen, delta: 0 },
    { key: "A", label: OMZA_LABELS.autonomie, value: averages.autonomie, delta: 0 },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
                Evaluatie Overzicht
              </h1>
              <p className="text-gray-600 mt-1 text-sm">
                Hier zie je een overzicht van je scores en een samenvatting van de
                ontvangen peer-feedback.
              </p>
            </div>
            <button
              onClick={() => router.push("/student")}
              className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Terug
            </button>
          </div>
        </header>
      </div>

      {/* Main Content - Single Card matching EvaluationCard style */}
      <main className="mx-auto max-w-6xl px-6 py-6">
        <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          {/* Card header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-slate-900">
                  {evaluationData.title}
                </h2>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                    evaluationData.status === "open"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                      : "bg-slate-50 text-slate-700 ring-slate-200"
                  }`}
                >
                  {evaluationData.status === "open" ? "Open" : "Afgerond"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {evaluationData.course} • Deadline:{" "}
                {evaluationData.deadlineISO
                  ? new Date(evaluationData.deadlineISO).toLocaleDateString("nl-NL")
                  : "Niet ingesteld"}
              </p>
            </div>
          </div>

          {/* Card content */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {/* AI-samenvatting + docent-opmerkingen */}
            <div className="flex flex-col gap-3 md:col-span-2">
              <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50/80 p-3 flex flex-col">
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>AI-samenvatting</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                    🤖 AI
                    <span className="h-1 w-1 rounded-full bg-emerald-400" />
                    Concept
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">
                  {evaluationData.aiSummary || "Geen AI-samenvatting beschikbaar."}
                </p>
              </div>

              <div className="flex-1 rounded-xl border border-slate-100 bg-white p-3 flex flex-col">
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Opmerkingen van de docent</span>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-indigo-600">
                    Docent
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">
                  {evaluationData.teacherComments || "Geen opmerkingen toegevoegd."}
                </p>
              </div>
            </div>

            {/* Right column: Team-bijdrage + Docentbeoordeling */}
            <div className="space-y-3">
              {/* Team-bijdrage / correctiefactor (GCF) */}
              {teamContributionFactor !== undefined && (
                <div className="rounded-xl border border-slate-100 bg-indigo-50/60 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>Team-bijdrage</span>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-indigo-600">
                      Correctiefactor
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div>
                      <p className="text-2xl font-semibold text-slate-900">
                        {teamContributionFactor.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500">Range 0,90 – 1,10</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700">
                      {teamContributionLabel}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-indigo-100">
                    <div
                      className="h-1.5 rounded-full bg-indigo-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, (teamContributionFactor - 0.9) * 500))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Factor waarmee de docent het groepscijfer corrigeert op basis van peer-feedback.
                  </p>
                </div>
              )}

              {/* Docentbeoordeling samenvatting */}
              {evaluationData.teacherGrade !== undefined && (
                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>Docent-beoordeling</span>
                    <span className="text-[11px] font-normal text-slate-400">Sprintgemiddelde</span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Eindcijfer</p>
                      <p className="text-2xl font-semibold text-slate-900">
                        {evaluationData.teacherGrade.toFixed(1)}
                      </p>
                    </div>
                    {evaluationData.teacherGradeTrend && (
                      <div className="text-right text-[11px] text-emerald-600">
                        {evaluationData.teacherGradeTrend}
                      </div>
                    )}
                  </div>
                  {evaluationData.teacherOmza && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {Object.entries(evaluationData.teacherOmza).map(([key, value]) => (
                        <span
                          key={key}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ring-1 ring-slate-200"
                        >
                          <span className="text-[10px] font-semibold text-slate-700 mr-1">{key}</span>
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] shadow-sm ${getOmzaEmojiColorClasses(value)}`}>
                            {getOmzaEmoji(value)}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* OMZA-balken (peer-feedback) */}
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {omzaAverages.map((item) => (
              <div key={item.key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{item.label}</span>
                  <div className="text-right">
                    <span className="block font-medium text-slate-700">
                      Gem.: {item.value.toFixed(1)}
                    </span>
                    <span
                      className={`block text-[11px] ${
                        item.delta > 0
                          ? "text-emerald-600"
                          : item.delta < 0
                          ? "text-red-600"
                          : "text-slate-500"
                      }`}
                    >
                      Δ {formatDelta(item.delta)} t.o.v. vorige scan
                    </span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
                  <div
                    className="h-1.5 rounded-full bg-indigo-500"
                    style={{ width: `${(item.value / 4) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">0 – 4 schaal uit peer-feedback.</p>
              </div>
            ))}
          </div>
        </article>
      </main>
    </div>
  );
}
