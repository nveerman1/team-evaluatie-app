"use client";

import { useEffect, useState } from "react";
import {
  calendarFeedService,
  type CalendarTokenResponse,
} from "@/services/calendar-feed.service";

interface CalendarSubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CalendarSubscribeModal({
  isOpen,
  onClose,
}: CalendarSubscribeModalProps) {
  const [tokenData, setTokenData] = useState<CalendarTokenResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadToken();
    }
  }, [isOpen]);

  async function loadToken() {
    setLoading(true);
    setError(null);
    try {
      const data = await calendarFeedService.getToken();
      setTokenData(data);
    } catch {
      setError("Kon abonnementsstatus niet ophalen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateToken() {
    setLoading(true);
    setError(null);
    setConfirmRevoke(false);
    try {
      const data = await calendarFeedService.generateToken();
      setTokenData(data);
    } catch {
      setError("Kon token niet aanmaken. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      return;
    }
    setRevoking(true);
    setError(null);
    setConfirmRevoke(false);
    try {
      await calendarFeedService.revokeToken();
      setTokenData(null);
    } catch {
      setError("Kon abonnement niet intrekken. Probeer het opnieuw.");
    } finally {
      setRevoking(false);
    }
  }

  async function handleCopy() {
    if (!tokenData) return;
    try {
      await navigator.clipboard.writeText(tokenData.webcal_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available — silently ignore
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                📤 Abonneer op kalender
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Ontvang automatisch bijgewerkte deadlines in je eigen
                agenda-app.
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 text-slate-400 hover:text-slate-600 text-xl leading-none"
              aria-label="Sluiten"
            >
              ×
            </button>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center text-slate-500 py-6 text-sm">
              Laden…
            </div>
          ) : tokenData ? (
            <>
              {/* Subscription URL */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Abonnements-URL (webcal://)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={tokenData.webcal_url}
                    className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-mono truncate"
                  />
                  <button
                    onClick={handleCopy}
                    className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                  >
                    {copied ? "✓ Gekopieerd" : "Kopieer"}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Wijzigingen in deadlines worden automatisch gesynchroniseerd
                  met je agenda.
                </p>
              </div>

              {/* Quick-add buttons */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Direct openen in
                </label>
                <div className="flex flex-col gap-2">
                  <a
                    href={tokenData.google_calendar_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                  >
                    <span>📅</span> Open in Google Calendar
                  </a>
                  <a
                    href={tokenData.outlook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-900 text-sm font-medium hover:bg-blue-100"
                  >
                    <span>📨</span> Open in Outlook
                  </a>
                  <a
                    href={tokenData.webcal_url}
                    className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-100"
                  >
                    <span>🍎</span> Open in Apple Calendar
                  </a>
                </div>
              </div>

              {/* Token management */}
              <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
                <button
                  onClick={handleGenerateToken}
                  disabled={loading}
                  className="rounded-xl px-4 py-2 text-sm border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 font-medium"
                >
                  🔄 Token vernieuwen
                  <span className="ml-1 text-xs font-normal text-amber-600">
                    (oude abonnementen stoppen)
                  </span>
                </button>

                {confirmRevoke ? (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-2 text-sm">
                    <p className="text-red-700 font-medium">
                      Weet je het zeker? Dit verwijdert het abonnement
                      permanent.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleRevoke}
                        disabled={revoking}
                        className="flex-1 rounded-lg px-3 py-1.5 bg-red-600 text-white text-xs font-medium hover:bg-red-700"
                      >
                        {revoking ? "Bezig…" : "Ja, intrekken"}
                      </button>
                      <button
                        onClick={() => setConfirmRevoke(false)}
                        className="flex-1 rounded-lg px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50"
                      >
                        Annuleren
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleRevoke}
                    disabled={revoking}
                    className="rounded-xl px-4 py-2 text-sm border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 font-medium"
                  >
                    🚫 Abonnement intrekken
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* No token yet */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 space-y-2">
                <p>
                  Je hebt nog geen kalender-abonnement. Genereer een
                  persoonlijke link om je agenda-app te abonneren op je
                  deadlines.
                </p>
                <p className="text-xs text-slate-500">
                  Elke keer dat je agenda-app de link opvraagt, worden de
                  meest recente deadlines opgehaald.
                </p>
              </div>
              <button
                onClick={handleGenerateToken}
                disabled={loading}
                className="w-full rounded-xl px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700"
              >
                {loading ? "Bezig…" : "📤 Abonnements-link aanmaken"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
