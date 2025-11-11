"use client";

import { useState, useEffect } from "react";
import { competencyService } from "@/services";
import type { CompetencyWindow, Competency } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";
import {
  ExternalInviteModal,
  ExternalInviteList,
} from "@/components/competency/ExternalInviteComponents";

export function CompetencyScanTab() {
  const [windows, setWindows] = useState<CompetencyWindow[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [showInviteModal, setShowInviteModal] = useState<{
    windowId: number;
    userId: number;
  } | null>(null);
  const [expandedWindow, setExpandedWindow] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wins, comps] = await Promise.all([
        competencyService.getWindows("open"),
        competencyService.getCompetencies(true),
      ]);
      setWindows(wins);
      setCompetencies(comps);

      // Get current user ID from any completed window overview
      // Try multiple windows if the first one fails
      if (wins.length > 0 && !currentUserId) {
        for (const win of wins) {
          try {
            const overview = await competencyService.getMyWindowOverview(win.id);
            setCurrentUserId(overview.user_id);
            break; // Successfully got user ID, exit loop
          } catch (err) {
            // Try next window if this one fails
            continue;
          }
        }
      }
    } catch (err) {
      console.error("Failed to load competency data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSuccess = () => {
    setShowInviteModal(null);
    // Optionally refresh data
  };

  const isExternalFeedbackEnabled = (window: CompetencyWindow) => {
    return window.settings?.allow_external_feedback === true;
  };

  if (loading) {
    return (
      <div className="p-6 border rounded-xl bg-gray-50">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border rounded-xl bg-gray-50">
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* My Growth Card */}
      <div className="rounded-xl border shadow-sm bg-green-50 p-4 space-y-3 w-full">
        <div className="px-4 py-2 rounded-t-xl font-semibold text-sm bg-green-200 text-green-900">
          Mijn Groei
        </div>
        <div className="text-sm text-gray-700">
          Bekijk je competentieontwikkeling en leerdoelen in één overzicht.
        </div>
        <Link
          href="/student/competency/growth"
          className="rounded-lg bg-green-600 text-white text-sm px-3 py-1.5 mt-2 inline-block"
        >
          Bekijk Groei →
        </Link>
      </div>

      {/* Competencies Card */}
      {competencies.length > 0 && (
        <div className="rounded-xl border shadow-sm bg-lime-50 p-4 space-y-3 w-full">
          <div className="px-4 py-2 rounded-t-xl font-semibold text-sm bg-lime-200 text-lime-900">
            Competenties die worden gevolgd
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            {competencies.map((comp) => (
              <span
                key={comp.id}
                className="px-3 py-1 border rounded-full text-sm"
              >
                {comp.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Open Windows */}
      {windows.length > 0 ? (
        <div className="space-y-4">
          {windows.map((window) => (
            <div
              key={window.id}
              className="border rounded-lg p-4 flex flex-col gap-2 bg-white w-full"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {window.title}
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                      Open
                    </span>
                  </div>
                  {window.end_date && (
                    <div className="text-sm text-gray-500">
                      Sluit op:{" "}
                      {new Date(window.end_date).toLocaleDateString("nl-NL")}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {window.require_self_score && (
                    <Link
                      href={`/student/competency/scan/${window.id}`}
                      className="rounded-lg bg-blue-600 text-white text-sm px-3 py-1.5"
                    >
                      Scan Invullen
                    </Link>
                  )}
                  {window.require_goal && (
                    <Link
                      href={`/student/competency/goal/${window.id}`}
                      className="rounded-lg bg-fuchsia-600 text-white text-sm px-3 py-1.5"
                    >
                      Leerdoel Instellen
                    </Link>
                  )}
                  {window.require_reflection && (
                    <Link
                      href={`/student/competency/reflection/${window.id}`}
                      className="rounded-lg bg-indigo-600 text-white text-sm px-3 py-1.5"
                    >
                      Reflectie Schrijven
                    </Link>
                  )}
                  {isExternalFeedbackEnabled(window) && (
                    <button
                      onClick={async () => {
                        // Get user ID if not already loaded
                        let userId = currentUserId;
                        if (!userId) {
                          try {
                            const overview =
                              await competencyService.getMyWindowOverview(
                                window.id
                              );
                            userId = overview.user_id;
                            setCurrentUserId(userId);
                          } catch (err) {
                            console.error("Failed to get user ID:", err);
                            // If we still can't get it, we'll handle this in the modal
                            // For now, try to proceed anyway
                          }
                        }
                        if (userId) {
                          setShowInviteModal({
                            windowId: window.id,
                            userId: userId,
                          });
                        }
                      }}
                      disabled={!currentUserId && loading}
                      className="rounded-lg bg-emerald-600 text-white text-sm px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Nodig Externen Uit
                    </button>
                  )}
                </div>
              </div>

              {/* External Invites List - Expandable */}
              {isExternalFeedbackEnabled(window) && currentUserId && (
                <div className="border-t pt-3 mt-2">
                  <button
                    onClick={() =>
                      setExpandedWindow(
                        expandedWindow === window.id ? null : window.id
                      )
                    }
                    className="text-sm text-blue-700 underline flex items-center gap-1"
                  >
                    <span>{expandedWindow === window.id ? "▼" : "▶"}</span>{" "}
                    Bekijk Uitnodigingen
                  </button>
                  {expandedWindow === window.id && (
                    <div className="mt-2">
                      <ExternalInviteList
                        windowId={window.id}
                        subjectUserId={currentUserId}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 border rounded-xl bg-gray-50 text-center">
          <p className="text-gray-500">
            Geen open competentiescans op dit moment.
          </p>
        </div>
      )}

      {/* External Invite Modal */}
      {showInviteModal && (
        <ExternalInviteModal
          windowId={showInviteModal.windowId}
          subjectUserId={showInviteModal.userId}
          onClose={() => setShowInviteModal(null)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </div>
  );
}
