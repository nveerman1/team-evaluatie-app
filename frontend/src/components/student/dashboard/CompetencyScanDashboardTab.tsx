"use client";

import { useState, useEffect } from "react";
import { competencyService } from "@/services";
import type { CompetencyWindow } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";
import { ScanDashboardCard } from "./ScanDashboardCard";
import {
  ExternalInviteModal,
  ExternalInviteList,
} from "@/components/competency/ExternalInviteComponents";

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
    <div className="space-y-4">
      {/* Mijn ontwikkeling Card */}
      <Card className="rounded-2xl border-slate-200 bg-slate-50">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-semibold text-slate-900">Mijn ontwikkeling</p>
              </div>
              <p className="text-sm text-slate-600">
                Hier vind je je competentiescans, leerdoelen en reflecties.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="rounded-full bg-indigo-50 text-indigo-700">
                Open scans: {openScansCount}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scan Cards */}
      <div className="grid gap-4">
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
          <div className="p-8 rounded-xl shadow-sm bg-slate-50 text-center">
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
