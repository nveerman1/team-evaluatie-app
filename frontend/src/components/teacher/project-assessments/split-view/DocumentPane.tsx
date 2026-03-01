'use client';

import React, { useState, useEffect, useRef } from 'react';
import { isTrustedMicrosoftUrl, getViewerUrl, shouldAttemptInlineEmbed, safeHostname } from '@/lib/document-viewer-utils';

interface DocumentPaneProps {
  docType: 'Verslag' | 'Presentatie';
  linkHealth: 'Onbekend' | 'OK' | 'Toegang gevraagd' | 'Kapotte link';
  currentDocUrl?: string | null;
  currentDocUpdatedAt?: string | null;
  hasLink: boolean;
  onDocTypeChange: (type: 'Verslag' | 'Presentatie') => void;
  onLinkHealthChange: (health: 'Onbekend' | 'OK' | 'Toegang gevraagd' | 'Kapotte link') => void;
  onOpenInTab?: () => void;
}

export function DocumentPane({
  docType,
  linkHealth,
  currentDocUrl,
  currentDocUpdatedAt = '—',
  hasLink,
  onDocTypeChange,
  onLinkHealthChange,
  onOpenInTab,
}: DocumentPaneProps) {
  // State for iframe blocking detection
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine if inline embedding should be attempted
  const isTrusted = isTrustedMicrosoftUrl(currentDocUrl);
  const embedDecision = shouldAttemptInlineEmbed(currentDocUrl);
  const viewerUrl = getViewerUrl(currentDocUrl);

  // Reset iframe blocked state when document URL changes
  useEffect(() => {
    // Clear blocked state when URL changes
    setIframeBlocked(false);
    
    // Clear any existing watchdog timer
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
    }
    
    // Set up a watchdog timer to detect if iframe doesn't load (only if we're trying to embed)
    if (hasLink && currentDocUrl && embedDecision.ok && viewerUrl) {
      watchdogTimerRef.current = setTimeout(() => {
        // If iframe hasn't loaded after timeout, mark as blocked
        setIframeBlocked(true);
      }, 5000); // 5 seconds — allows time for redirect chains (e.g. 1drv.ms)
    }
    
    return () => {
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
      }
    };
  }, [currentDocUrl, hasLink, embedDecision.ok, viewerUrl]);

  // Handle iframe load success.
  // A successful onLoad means the content loaded; the watchdog timer + handleIframeError handle real failures.
  // If Microsoft blocks embedding (e.g. X-Frame-Options), neither onLoad nor onError fires, so the watchdog catches it.
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
    <section className="border-x border-b border-slate-200 bg-white shadow-sm flex flex-col h-full overflow-hidden">
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
        </div>
      </div>

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
          ) : embedDecision.ok && viewerUrl ? (
            <>
              {/* Iframe viewer - only render for direct PDF links */}
              <iframe
                ref={iframeRef}
                src={viewerUrl}
                className="w-full h-full"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
                allow="clipboard-read; clipboard-write"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                title="Document viewer"
              />
              
              {/* Fallback overlay when iframe is blocked after render */}
              {iframeBlocked && (
                <div className="absolute inset-0 bg-white flex items-center justify-center px-6 text-center">
                  <div className="space-y-4 max-w-md">
                    <div className="text-3xl">📄</div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-1">
                        Document kan niet worden getoond
                      </p>
                      <p className="text-xs text-slate-500">
                        Microsoft staat het inladen van dit document in de app niet toe.
                        Open het document in een nieuw tabblad.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 items-center">
                      <button
                        onClick={onOpenInTab}
                        className="rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 shadow-sm"
                      >
                        📄 Open in nieuw tabblad
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                      {currentDocUrl}
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            // Show fallback immediately for web-viewer and other non-embeddable links
            <div className="h-full flex items-center justify-center px-6 text-center">
              <div className="space-y-4 max-w-md">
                <div className="text-3xl">📄</div>
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">
                    Document kan niet worden getoond
                  </p>
                  <p className="text-xs text-slate-500">
                    Deze link opent een web-viewer die niet in de app ingeladen kan worden.
                    Gebruik een directe download- of deellink voor inline weergave,
                    of open het document via het tabblad.
                  </p>
                </div>
                <div className="flex flex-col gap-2 items-center">
                  <button
                    onClick={onOpenInTab}
                    className="rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 shadow-sm"
                  >
                    📄 Open in nieuw tabblad
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  {currentDocUrl}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
