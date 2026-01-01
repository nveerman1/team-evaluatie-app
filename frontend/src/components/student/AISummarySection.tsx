"use client";

import { useAsyncSummary } from "@/hooks/useAsyncSummary";
import { useState } from "react";

type AISummarySectionProps = {
  evaluationId: number;
  studentId: number;
  fallbackSummary?: string;
  useAsync?: boolean;
};

export function AISummarySection({
  evaluationId,
  studentId,
  fallbackSummary,
  useAsync = true,
}: AISummarySectionProps) {
  const {
    summary,
    status,
    error,
    generationMethod,
    retryGeneration,
    isPolling,
  } = useAsyncSummary(evaluationId, studentId, {
    autoStart: useAsync,
    useSync: !useAsync,
    pollingInterval: 3000,
  });

  const displaySummary = summary || fallbackSummary;

  return (
    <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50/80 p-3 flex flex-col">
      <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
        <span>AI-samenvatting</span>
        <StatusBadge status={status} isPolling={isPolling} method={generationMethod} />
      </div>

      {status === "loading" || status === "queued" || status === "processing" ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="mb-3">
            <LoadingSpinner />
          </div>
          <p className="text-sm text-slate-600 mb-1">
            {status === "queued" 
              ? "Samenvatting wordt in de wachtrij geplaatst..."
              : status === "processing"
              ? "AI genereert je samenvatting..."
              : "Samenvatting laden..."}
          </p>
          {isPolling && (
            <p className="text-xs text-slate-400">
              We checken elke paar seconden of je samenvatting klaar is
            </p>
          )}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-6">
          <div className="mb-3 text-red-500">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-slate-700 mb-2 text-center">
            Er ging iets mis bij het genereren van de samenvatting
          </p>
          <p className="text-xs text-slate-500 mb-3 text-center">{error}</p>
          <button
            onClick={retryGeneration}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Opnieuw proberen
          </button>
        </div>
      ) : displaySummary ? (
        <p className="text-sm leading-relaxed text-slate-700">{displaySummary}</p>
      ) : (
        <p className="text-sm leading-relaxed text-slate-500 italic">
          Nog geen AI-samenvatting beschikbaar. Deze wordt gegenereerd zodra er peer-feedback is ontvangen.
        </p>
      )}
    </div>
  );
}

function StatusBadge({ 
  status, 
  isPolling, 
  method 
}: { 
  status: string; 
  isPolling: boolean;
  method: string | null;
}) {
  if (status === "loading" || status === "queued" || status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-blue-700">
        {isPolling && <span className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />}
        {status === "queued" ? "In wachtrij" : status === "processing" ? "Genereren" : "Laden"}
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-700">
        <span className="h-1 w-1 rounded-full bg-red-500" />
        Mislukt
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700">
        🤖 AI
        <span className="h-1 w-1 rounded-full bg-emerald-500" />
        {method === "ai" ? "Gereed" : method === "fallback" ? "Basis" : "Klaar"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
      🤖 AI
      <span className="h-1 w-1 rounded-full bg-slate-400" />
      Concept
    </span>
  );
}

function LoadingSpinner() {
  return (
    <div className="relative h-10 w-10">
      <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
      <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
    </div>
  );
}
