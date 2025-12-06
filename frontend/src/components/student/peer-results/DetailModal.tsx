"use client";

import React, { useState } from "react";
import { EvaluationResult, OmzaKey } from "@/dtos";
import { OMZA_LABELS, mean, round1, getOmzaEmoji, formatDelta } from "./helpers";

type DetailModalProps = {
  open: boolean;
  onClose: () => void;
  evaluation?: EvaluationResult;
};

type TabKey = "summary" | "peers" | "reflection";

export function DetailModal({ open, onClose, evaluation }: DetailModalProps) {
  const [tab, setTab] = useState<TabKey>("summary");

  if (!open || !evaluation) return null;

  const avg: Record<OmzaKey, number> = (
    ["organiseren", "meedoen", "zelfvertrouwen", "autonomie"] as OmzaKey[]
  ).reduce((acc, k) => {
    const list = evaluation.peers.map((p) => p.scores[k]).filter(Boolean);
    acc[k] = round1(mean(list));
    return acc;
  }, {} as Record<OmzaKey, number>);

  // Convert gcfScore to teamContributionFactor if not provided
  const teamContributionFactor = evaluation.teamContributionFactor ??
    (evaluation.gcfScore !== undefined ? 0.9 + (evaluation.gcfScore / 100) * 0.2 : undefined);

  const teamContributionLabel = evaluation.teamContributionLabel ??
    (teamContributionFactor !== undefined
      ? teamContributionFactor >= 1.05
        ? "Boven verwachting"
        : teamContributionFactor >= 0.95
        ? "Naar verwachting"
        : "Onder verwachting"
      : undefined);

  // Use omzaAverages if provided, otherwise calculate from peers
  const omzaAverages = evaluation.omzaAverages ?? [
    { key: "O", label: OMZA_LABELS.organiseren, value: avg.organiseren, delta: 0 },
    { key: "M", label: OMZA_LABELS.meedoen, value: avg.meedoen, delta: 0 },
    { key: "Z", label: OMZA_LABELS.zelfvertrouwen, value: avg.zelfvertrouwen, delta: 0 },
    { key: "A", label: OMZA_LABELS.autonomie, value: avg.autonomie, delta: 0 },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl">
        {/* Modal header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{evaluation.title}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {evaluation.course} • Deadline:{" "}
              {evaluation.deadlineISO
                ? new Date(evaluation.deadlineISO).toLocaleDateString("nl-NL")
                : "Niet ingesteld"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6 pt-3">
          <div className="flex gap-2">
            {(
              [
                { key: "summary", label: "Samenvatting" },
                { key: "peers", label: "Feedback per teamgenoot" },
                { key: "reflection", label: "Eigen reflectie" },
              ] as { key: TabKey; label: string }[]
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  tab === t.key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal content */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          {tab === "summary" && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {/* AI-samenvatting + docent-opmerkingen */}
                <div className="space-y-3 md:col-span-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      AI-samenvatting
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      {evaluation.aiSummary || "Geen AI-samenvatting beschikbaar."}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-white p-4">
                    <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
                      <span>Opmerkingen van de docent</span>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-indigo-600">
                        Docent
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                      {evaluation.teacherComments || "Geen opmerkingen toegevoegd."}
                    </p>
                  </div>
                </div>

                {/* Samenvattende cijfers */}
                <div className="space-y-3">
                  {teamContributionFactor !== undefined && (
                    <div className="rounded-xl border border-slate-100 bg-indigo-50/70 p-3">
                      <p className="text-xs font-semibold text-slate-700">
                        Team-bijdrage (correctiefactor)
                      </p>
                      <div className="mt-2 flex items-baseline justify-between">
                        <p className="text-2xl font-semibold text-slate-900">
                          {teamContributionFactor.toFixed(2)}
                        </p>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700">
                          {teamContributionLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Toegepast op het groepscijfer van de sprint.
                      </p>
                    </div>
                  )}

                  {evaluation.teacherGrade !== undefined && (
                    <div className="rounded-xl border border-slate-100 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-700">Docentbeoordeling</p>
                      <div className="mt-2 flex items-baseline justify-between">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">
                            Eindcijfer sprint
                          </p>
                          <p className="text-2xl font-semibold text-slate-900">
                            {evaluation.teacherGrade.toFixed(1)}
                          </p>
                        </div>
                        {evaluation.teacherGradeTrend && (
                          <div className="text-right text-[11px] text-emerald-600">
                            {evaluation.teacherGradeTrend}
                          </div>
                        )}
                      </div>
                      {evaluation.teacherOmza && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {Object.entries(evaluation.teacherOmza).map(([key, value]) => (
                            <span
                              key={key}
                              className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200"
                            >
                              <span className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] shadow-sm">
                                {getOmzaEmoji(value)}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-700">
                                {key}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                {omzaAverages.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                  >
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
                    <p className="mt-1 text-[11px] text-slate-500">
                      Gebaseerd op scores van je teamgenoten.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "peers" && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-600">
              Hier komt een overzicht met feedback per teamgenoot (naam, scores per OMZA,
              kernfeedback). Dit is een placeholder voor de mockup.
            </div>
          )}

          {tab === "reflection" && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-600">
              Hier komt de eigen reflectie van de leerling op de ontvangen feedback en de gemaakte
              afspraken voor de volgende sprint.
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
          <p className="text-xs text-slate-500">
            Tip: gebruik deze resultaten bij het invullen van je reflectie en het bespreken met je
            docent.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Sluiten
            </button>
            <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700">
              Exporteren als PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
