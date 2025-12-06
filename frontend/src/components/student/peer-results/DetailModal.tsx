"use client";

import React, { useState } from "react";
import { EvaluationResult, OmzaKey } from "@/dtos";
import { GcfMiniCard } from "./GcfMiniCard";
import { ProgressBar } from "./ProgressBar";
import { Sparkline } from "./Sparkline";
import { OMZA_LABELS, mean, round1, classNames } from "./helpers";

type DetailModalProps = {
  open: boolean;
  onClose: () => void;
  evaluation?: EvaluationResult;
};

export function DetailModal({ open, onClose, evaluation }: DetailModalProps) {
  const [tab, setTab] = useState<"summary" | "peers" | "reflection">(
    "summary"
  );

  if (!open || !evaluation) return null;

  const avg: Record<OmzaKey, number> = (
    ["organiseren", "meedoen", "zelfvertrouwen", "autonomie"] as OmzaKey[]
  ).reduce((acc, k) => {
    const list = evaluation.peers.map((p) => p.scores[k]).filter(Boolean);
    acc[k] = round1(mean(list));
    return acc;
  }, {} as Record<OmzaKey, number>);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl ring-1 ring-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {evaluation.title}
            </h3>
            <p className="text-sm text-gray-600">{evaluation.course}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Sluiten"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {[
              { id: "summary", label: "Samenvatting" },
              { id: "peers", label: "Feedback per teamgenoot" },
              { id: "reflection", label: "Eigen reflectie" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as typeof tab)}
                className={classNames(
                  "rounded-md px-3 py-1.5 text-sm ring-1",
                  tab === t.id
                    ? "bg-blue-600 text-white ring-blue-600"
                    : "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-5">
          {tab === "summary" && (
            <div className="space-y-5">
              {evaluation.aiSummary && (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="flex-1 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm leading-relaxed text-gray-800">
                    <div className="mb-1 font-medium text-blue-900">
                      AI-samenvatting
                    </div>
                    <p>{evaluation.aiSummary}</p>
                  </div>
                  {typeof evaluation.gcfScore === "number" && (
                    <GcfMiniCard value={evaluation.gcfScore} />
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(Object.keys(OMZA_LABELS) as OmzaKey[]).map((k) => (
                  <div key={k} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {OMZA_LABELS[k]}
                      </p>
                      <span className="text-sm text-gray-600">
                        Gem.: {avg[k]}
                      </span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={avg[k]} />
                    </div>
                    {evaluation.trend?.[k] && (
                      <div className="mt-3">
                        <Sparkline points={evaluation.trend[k]!} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "peers" && (
            <div className="space-y-3">
              {evaluation.peers.map((p, idx) => (
                <div key={idx} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {p.peerLabel}
                    </p>
                    <div className="flex gap-3 text-xs text-gray-600">
                      {(Object.keys(OMZA_LABELS) as OmzaKey[]).map((k) => (
                        <span key={k}>
                          <span className="text-gray-500">
                            {OMZA_LABELS[k]}:
                          </span>{" "}
                          {round1(p.scores[k])}
                        </span>
                      ))}
                    </div>
                  </div>
                  {p.notes && (
                    <p className="mt-2 text-sm text-gray-700">{p.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "reflection" && (
            <div className="space-y-2">
              {evaluation.reflection ? (
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">
                    {evaluation.reflection.text}
                  </div>
                  {evaluation.reflection.submittedAt && (
                    <div className="mt-3 text-xs text-gray-500">
                      Ingediend op: {new Date(evaluation.reflection.submittedAt).toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
                  <p className="italic">
                    Er is nog geen reflectie ingevuld voor deze evaluatie.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm shadow-sm transition focus-visible:outline focus-visible:outline-2 bg-white text-gray-900 ring-1 ring-gray-300 hover:bg-gray-50 focus-visible:outline-gray-400"
          >
            Sluiten
          </button>
          <button
            onClick={() => alert("PDF export – TODO")}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm shadow-sm transition focus-visible:outline focus-visible:outline-2 bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-blue-600"
          >
            Exporteren als PDF
          </button>
        </div>
      </div>
    </div>
  );
}
