'use client';

import React from 'react';

interface DocumentPaneProps {
  docWidth: number;
  maxDocWidth: number;
  docType: 'Verslag' | 'Presentatie';
  linkHealth: 'Onbekend' | 'OK' | 'Toegang gevraagd' | 'Kapotte link';
  currentDocUrl?: string | null;
  currentDocUpdatedAt?: string | null;
  hasLink: boolean;
  docMenuOpen: boolean;
  onDocWidthChange: (width: number) => void;
  onDocTypeChange: (type: 'Verslag' | 'Presentatie') => void;
  onLinkHealthChange: (health: 'Onbekend' | 'OK' | 'Toegang gevraagd' | 'Kapotte link') => void;
  onToggleDocMenu: () => void;
  onClose: () => void;
  onOpenInTab?: () => void;
}

export function DocumentPane({
  docWidth,
  maxDocWidth,
  docType,
  linkHealth,
  currentDocUrl,
  currentDocUpdatedAt = '—',
  hasLink,
  docMenuOpen,
  onDocWidthChange,
  onDocTypeChange,
  onLinkHealthChange,
  onToggleDocMenu,
  onClose,
  onOpenInTab,
}: DocumentPaneProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col h-[calc(100vh-260px)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 shrink-0">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Ingeleverd werk</div>
          <div className="mt-0.5 text-xs text-slate-500 truncate">
            Laatst bijgewerkt: {currentDocUpdatedAt}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Doc type toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {['Verslag', 'Presentatie'].map((t) => (
              <button
                key={t}
                onClick={() => onDocTypeChange(t as 'Verslag' | 'Presentatie')}
                className={
                  'rounded-md px-2 py-1 text-xs font-medium transition ' +
                  (docType === t
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:bg-white')
                }
              >
                {t}
              </button>
            ))}
          </div>

          {/* Status dropdown */}
          <select
            value={linkHealth}
            onChange={(e) =>
              onLinkHealthChange(
                e.target.value as 'Onbekend' | 'OK' | 'Toegang gevraagd' | 'Kapotte link'
              )
            }
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
            disabled={!hasLink}
          >
            <option>Onbekend</option>
            <option>OK</option>
            <option>Toegang gevraagd</option>
            <option>Kapotte link</option>
          </select>

          <button
            className={
              'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 ' +
              (hasLink ? 'text-slate-700' : 'text-slate-400')
            }
            onClick={onOpenInTab}
            disabled={!hasLink}
          >
            Open in tab
          </button>

          <button
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={onToggleDocMenu}
            aria-label="Paneelinstellingen"
          >
            ⚙︎
          </button>

          <button
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Sluiten
          </button>
        </div>
      </div>

      {/* Paneelbreedte rij */}
      {docMenuOpen && (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 shrink-0">
          <div className="flex items-center gap-4">
            <div className="text-xs font-semibold text-slate-700">Paneelbreedte</div>
            <input
              type="range"
              min={340}
              max={maxDocWidth}
              value={docWidth}
              onChange={(e) => onDocWidthChange(parseInt(e.target.value, 10))}
              className="flex-1"
            />
            <div className="w-12 text-right text-xs text-slate-500">{docWidth}px</div>
          </div>
        </div>
      )}

      {/* Viewer */}
      <div className="flex-1 min-h-0 bg-slate-50 p-3">
        <div className="h-full rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="h-full flex items-center justify-center px-6 text-center text-xs text-slate-500">
            {hasLink ? (
              <div className="space-y-2">
                <p>Hier zou een iframe / embedded viewer staan.</p>
                <p className="text-slate-400">{currentDocUrl}</p>
              </div>
            ) : (
              'Geen link ingeleverd.'
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
