import React from "react";

type PageHeaderProps = {
  onRefresh?: () => void;
  onExportAll?: () => void;
};

export function PageHeader({ onRefresh, onExportAll }: PageHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Peer-feedback resultaten
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Overzicht van ontvangen feedback, OMZA-scores, docentbeoordeling en groei.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onRefresh}
          >
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Vernieuwen
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            onClick={onExportAll}
          >
            <span className="mr-2">📄</span>
            Exporteren als PDF
          </button>
        </div>
      </div>
    </header>
  );
}
