'use client';

import React, { useState, useEffect, useRef } from 'react';
import { isTrustedMicrosoftUrl, getFileHint, getViewerUrl } from '@/lib/document-viewer-utils';

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
  // State for iframe blocking detection
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset iframe blocked state when document URL changes
  useEffect(() => {
    setIframeBlocked(false);
    
    // Clear any existing watchdog timer
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
    }
    
    // Set up a watchdog timer to detect if iframe doesn't load
    if (hasLink && currentDocUrl) {
      watchdogTimerRef.current = setTimeout(() => {
        // If iframe hasn't loaded after timeout, mark as potentially blocked
        // This will be overridden if onLoad fires
        setIframeBlocked(true);
      }, 3500); // 3.5 seconds timeout
    }
    
    return () => {
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
      }
    };
  }, [currentDocUrl, hasLink]);

  // Determine if URL is trusted
  const isTrusted = isTrustedMicrosoftUrl(currentDocUrl);
  const fileHint = getFileHint(currentDocUrl);
  const viewerUrl = getViewerUrl(currentDocUrl, fileHint);

  // Handle iframe load success
  const handleIframeLoad = () => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
    }
    setIframeBlocked(false);
  };

  // Handle iframe load error
  const handleIframeError = () => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
    }
    setIframeBlocked(true);
  };
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col h-[calc(100vh-130px)] overflow-hidden">
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
            <span aria-hidden="true">⚙</span>
            <span className="sr-only">Instellingen</span>
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
        <div className="h-full rounded-2xl border border-slate-200 bg-white overflow-hidden relative">
          {!hasLink ? (
            <div className="h-full flex items-center justify-center px-6 text-center text-xs text-slate-500">
              Geen link ingeleverd.
            </div>
          ) : !isTrusted ? (
            <div className="h-full flex items-center justify-center px-6 text-center">
              <div className="space-y-3 max-w-md">
                <div className="text-2xl">⚠️</div>
                <p className="text-sm font-medium text-slate-700">Onbekende link</p>
                <p className="text-xs text-slate-500">
                  Deze link is niet van een vertrouwd Microsoft-domein.
                </p>
                <button
                  onClick={onOpenInTab}
                  className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  Open in nieuw tabblad
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Iframe viewer */}
              <iframe
                ref={iframeRef}
                src={viewerUrl || ''}
                className="w-full h-full"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
                allow="clipboard-read; clipboard-write"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                title="Document viewer"
              />
              
              {/* Fallback overlay when iframe is blocked */}
              {iframeBlocked && (
                <div className="absolute inset-0 bg-white flex items-center justify-center px-6 text-center">
                  <div className="space-y-4 max-w-md">
                    <div className="text-3xl">🔒</div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-1">
                        Inline weergave geblokkeerd
                      </p>
                      <p className="text-xs text-slate-500">
                        Microsoft SharePoint/OneDrive blokkeert vaak het embedden van documenten. 
                        Gebruik de knop hieronder om het document in een nieuw tabblad te openen.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 items-center">
                      <button
                        onClick={onOpenInTab}
                        className="rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 shadow-sm"
                      >
                        📄 Open in nieuw tabblad
                      </button>
                      {fileHint !== 'pdf' && (
                        <button
                          onClick={() => {
                            if (currentDocUrl && isTrusted) {
                              // Only construct Office Online viewer URL if the original URL is trusted
                              // Check if it's already an office.com URL using proper hostname validation
                              try {
                                const urlObj = new URL(currentDocUrl);
                                const isOfficeUrl = urlObj.hostname.toLowerCase().endsWith('office.com') ||
                                                   urlObj.hostname.toLowerCase().endsWith('officeapps.live.com');
                                
                                const officeUrl = isOfficeUrl
                                  ? currentDocUrl 
                                  : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(currentDocUrl)}`;
                                window.open(officeUrl, '_blank');
                              } catch (e) {
                                // Invalid URL, do nothing
                                console.error('Invalid URL for Office Online viewer:', e);
                              }
                            }
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Open in Office Online
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                      {currentDocUrl}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
