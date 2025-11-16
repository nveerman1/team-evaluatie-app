import React from "react";

type PageHeaderProps = {
  onRefresh?: () => void;
  onExportAll?: () => void;
};

export function PageHeader({ onRefresh, onExportAll }: PageHeaderProps) {
  return (
    <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
      <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
            Peer-feedback resultaten
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Overzicht van ontvangen feedback, scores en groei.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onRefresh}
          >
            🔄 Vernieuwen
          </button>
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            onClick={onExportAll}
          >
            📤 Exporteren als PDF
          </button>
        </div>
      </header>
    </div>
  );
}
