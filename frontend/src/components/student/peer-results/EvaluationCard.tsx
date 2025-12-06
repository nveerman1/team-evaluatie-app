"use client";

import React, { useMemo } from "react";
import { EvaluationResult, OmzaKey } from "@/dtos";
import { Badge } from "./Badge";
import { GcfMiniCard } from "./GcfMiniCard";
import { ProgressBar } from "./ProgressBar";
import { Sparkline } from "./Sparkline";
import { OMZA_LABELS, mean, round1 } from "./helpers";

type EvaluationCardProps = {
  data: EvaluationResult;
  onOpen: (ev: EvaluationResult) => void;
};

export function EvaluationCard({ data, onOpen }: EvaluationCardProps) {
  const averages = useMemo(() => {
    const obj: Record<OmzaKey, number> = {
      organiseren: 0,
      meedoen: 0,
      zelfvertrouwen: 0,
      autonomie: 0,
    };
    (Object.keys(obj) as OmzaKey[]).forEach((k) => {
      const list = data.peers.map((p) => p.scores[k]).filter(Boolean);
      obj[k] = round1(mean(list));
    });
    return obj;
  }, [data]);

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 hover:shadow-md transition-shadow relative">
      {/* Bekijk detail button - top right */}
      <button
        className="absolute top-4 right-4 px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50"
        onClick={() => onOpen(data)}
      >
        Bekijk detail
      </button>

      <div className="pr-32">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">{data.title}</h3>
          {data.status === "open" && <Badge color="green">Open</Badge>}
          {data.status === "closed" && <Badge color="gray">Afgerond</Badge>}
          {data.status === "processing" && (
            <Badge color="amber">In verwerking</Badge>
          )}
        </div>
        <p className="mt-0.5 text-sm text-gray-600">{data.course}</p>
        {data.deadlineISO && (
          <p className="text-xs text-gray-500">
            Deadline: {new Date(data.deadlineISO).toLocaleDateString()}
          </p>
        )}
      </div>

      {(data.aiSummary || typeof data.gcfScore === "number") && (
        <div className="mt-3 flex flex-row justify-between items-start gap-3">
          {data.aiSummary && (
            <div className="flex-1 rounded-xl border border-gray-200/80 bg-white p-3 text-sm leading-relaxed text-gray-800">
              <div className="mb-1 font-medium text-gray-900">AI-samenvatting</div>
              <p className="line-clamp-4">{data.aiSummary}</p>
            </div>
          )}
          {typeof data.gcfScore === "number" && (
            <div className="shrink-0">
              <GcfMiniCard value={data.gcfScore} />
            </div>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(OMZA_LABELS) as OmzaKey[]).map((k) => (
          <div key={k} className="rounded-xl border border-gray-200/80 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">
                {OMZA_LABELS[k]}
              </p>
              <span className="text-xs text-gray-500">Gem.: {averages[k]}</span>
            </div>
            <div className="mt-2">
              <ProgressBar value={averages[k]} />
            </div>
            {data.trend?.[k] && (
              <div className="mt-2">
                <Sparkline points={data.trend[k]!} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
