"use client";

import { useState, useEffect } from "react";
import { competencyService } from "@/services";
import type { CompetencyWindow } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { ScanDashboardCard } from "./ScanDashboardCard";
import {
  ExternalInviteModal,
  ExternalInviteList,
} from "@/components/competency/ExternalInviteComponents";
import { cn } from "@/lib/utils";

type FilterType = "open" | "alles" | "gesloten";

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "alles", label: "Alles" },
  { value: "gesloten", label: "Gesloten" },
];

type CompetencyScanDashboardTabProps = {
  searchQuery?: string;
};

export function CompetencyScanDashboardTab({ searchQuery = "" }: CompetencyScanDashboardTabProps) {
  const [windows, setWindows] = useState<CompetencyWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [showInviteModal, setShowInviteModal] = useState<{
    windowId: number;
    userId: number;
  } | null>(null);
  const [expandedWindow, setExpandedWindow] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterType>("open");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const wins = await competencyService.getWindows("all");
      setWindows(wins);

      if (wins.length > 0 && !currentUserId) {
        for (const win of wins) {
          try {
            const overview = await competencyService.getMyWindowOverview(win.id);
            setCurrentUserId(overview.user_id);
            break;
          } catch (err) {
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
  };

  const isExternalFeedbackEnabled = (window: CompetencyWindow) => {
    return window.settings?.allow_external_feedback === true;
  };

  if (loading) {
    return (
      <div className="p-6 rounded-xl shadow-sm bg-slate-50">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl shadow-sm bg-slate-50">
        <ErrorMessage message={error} />
      </div>
    );
  }

  const searchFiltered = searchQuery.trim()
    ? windows.filter((w) => w.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : windows;

  const filteredWindows = searchFiltered.filter((w) => {
    if (filter === "open") return w.status === "open";
    if (filter === "gesloten") return w.status !== "open";
    return true;
  });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Card header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Competentiescans</h2>
          <p className="mt-1 text-sm text-slate-500">
            Krijg inzicht in je competenties en werk aan je leerdoelen.
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition",
                filter === value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Scan Cards */}
      <div className="mt-5 space-y-3">
        {filteredWindows.length > 0 ? (
          filteredWindows.map((window) => (
            <div key={window.id} className="space-y-2">
              <ScanDashboardCard
                window={window}
                hasInvites={isExternalFeedbackEnabled(window)}
                onShowInvites={() => {
                  if (currentUserId) {
                    if (expandedWindow === window.id) {
                      setExpandedWindow(null);
                    } else {
                      setExpandedWindow(window.id);
                    }
                  }
                }}
                onInviteExternal={async () => {
                  let userId = currentUserId;
                  if (!userId) {
                    try {
                      const overview = await competencyService.getMyWindowOverview(window.id);
                      userId = overview.user_id;
                      setCurrentUserId(userId);
                    } catch (err) {
                      console.error("Failed to get user ID:", err);
                    }
                  }
                  if (userId) {
                    setShowInviteModal({
                      windowId: window.id,
                      userId: userId,
                    });
                  }
                }}
              />
              {isExternalFeedbackEnabled(window) &&
               expandedWindow === window.id &&
               currentUserId && (
                <div className="ml-4 pl-4 border-l-2 border-slate-200">
                  <ExternalInviteList
                    windowId={window.id}
                    subjectUserId={currentUserId}
                  />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-xl bg-slate-50 p-8 text-center">
            <p className="text-slate-500">
              {searchQuery ? "Geen competentiescans gevonden met deze zoekopdracht." : filter === "gesloten" ? "Geen gesloten competentiescans." : "Geen open competentiescans op dit moment."}
            </p>
          </div>
        )}
      </div>

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


type CompetencyScanDashboardTabProps = {
  searchQuery?: string;
};

export function CompetencyScanDashboardTab({ searchQuery = "" }: CompetencyScanDashboardTabProps) {
  const [windows, setWindows] = useState<CompetencyWindow[]>([]);
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
      const wins = await competencyService.getWindows("open");
      setWindows(wins);

      // Get current user ID from any completed window overview
      if (wins.length > 0 && !currentUserId) {
        for (const win of wins) {
          try {
            const overview = await competencyService.getMyWindowOverview(
              win.id,
            );
            setCurrentUserId(overview.user_id);
            break;
          } catch (err) {
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
  };

  const isExternalFeedbackEnabled = (window: CompetencyWindow) => {
    return window.settings?.allow_external_feedback === true;
  };

  if (loading) {
    return (
      <div className="p-6 rounded-xl shadow-sm bg-slate-50">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl shadow-sm bg-slate-50">
        <ErrorMessage message={error} />
      </div>
    );
  }

  // Filter windows by search query
  const filteredWindows = searchQuery.trim()
    ? windows.filter((w) => w.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : windows;

  const openScansCount = windows.filter((w) => w.status === "open").length;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Card header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Competentiescans</h2>
          <p className="mt-1 text-sm text-slate-500">
            {openScansCount} open {openScansCount === 1 ? "scan" : "scans"} beschikbaar.
          </p>
        </div>
      </div>

      {/* Scan Cards */}
      <div className="mt-5 space-y-3">
        {filteredWindows.length > 0 ? (
          filteredWindows.map((window) => (
            <div key={window.id} className="space-y-2">
              <ScanDashboardCard
                window={window}
                hasInvites={isExternalFeedbackEnabled(window)}
                onShowInvites={() => {
                  if (currentUserId) {
                    if (expandedWindow === window.id) {
                      setExpandedWindow(null);
                    } else {
                      setExpandedWindow(window.id);
                    }
                  }
                }}
                onInviteExternal={async () => {
                  let userId = currentUserId;
                  if (!userId) {
                    try {
                      const overview = await competencyService.getMyWindowOverview(window.id);
                      userId = overview.user_id;
                      setCurrentUserId(userId);
                    } catch (err) {
                      console.error("Failed to get user ID:", err);
                    }
                  }
                  if (userId) {
                    setShowInviteModal({
                      windowId: window.id,
                      userId: userId,
                    });
                  }
                }}
              />
              {isExternalFeedbackEnabled(window) && 
               expandedWindow === window.id && 
               currentUserId && (
                <div className="ml-4 pl-4 border-l-2 border-slate-200">
                  <ExternalInviteList
                    windowId={window.id}
                    subjectUserId={currentUserId}
                  />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-xl bg-slate-50 p-8 text-center">
            <p className="text-slate-500">
              {searchQuery ? "Geen competentiescans gevonden met deze zoekopdracht." : "Geen open competentiescans op dit moment."}
            </p>
          </div>
        )}
      </div>

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
