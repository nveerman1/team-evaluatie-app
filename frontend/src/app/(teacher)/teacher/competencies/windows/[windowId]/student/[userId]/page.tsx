"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { competencyService } from "@/services";
import type { StudentCompetencyOverview, CompetencySelfScore, CompetencyWindow } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";
import {
  ExternalInviteModal,
  ExternalInviteList,
} from "@/components/competency/ExternalInviteComponents";

export default function StudentDetailPage() {
  const params = useParams();
  const windowId = Number(params.windowId);
  const userId = Number(params.userId);

  const [overview, setOverview] = useState<StudentCompetencyOverview | null>(null);
  const [selfScores, setSelfScores] = useState<CompetencySelfScore[]>([]);
  const [rubricLevels, setRubricLevels] = useState<Record<number, any[]>>({});
  const [window, setWindow] = useState<CompetencyWindow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [expandedInvites, setExpandedInvites] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowId, userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, scores, windowData] = await Promise.all([
        competencyService.getStudentWindowOverview(windowId, userId),
        competencyService.getMySelfScores(windowId).catch(() => []), // Fallback if not accessible
        competencyService.getWindow(windowId),
      ]);
      setOverview(data);
      setSelfScores(scores);
      setWindow(windowData);

      // Load rubric levels for each competency
      const levelsMap: Record<number, any[]> = {};
      await Promise.all(
        data.scores.map(async (score) => {
          try {
            const levels = await competencyService.getRubricLevels(score.competency_id);
            levelsMap[score.competency_id] = levels;
          } catch (err) {
            levelsMap[score.competency_id] = [];
          }
        })
      );
      setRubricLevels(levelsMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!overview) return <ErrorMessage message="Student data not found" />;

  // Helper function to get rubric level info for a score
  const getRubricLevelInfo = (competencyId: number, score: number | null | undefined) => {
    if (score === null || score === undefined) return null;
    const levels = rubricLevels[competencyId] || [];
    const roundedScore = Math.round(score);
    const rubricLevel = levels.find((rl: any) => rl.level === roundedScore);
    return rubricLevel;
  };

  const isExternalFeedbackEnabled = () => {
    return window?.settings?.allow_external_feedback === true;
  };

  const handleInviteSuccess = () => {
    setShowInviteModal(false);
    // Refresh will happen when user expands the invite list
    // No need to reload all data since invites don't affect scores
  };

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/teacher/competencies/windows/${windowId}`}
          className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block"
        >
          ← Terug naar Heatmap
        </Link>
        <h1 className="text-3xl font-bold mb-2">
          {overview.user_name} - Competentieoverzicht
        </h1>
        <p className="text-gray-600">
          Gedetailleerd overzicht van competentiescores, leerdoelen en reflecties
        </p>
      </div>

      {/* External Invites Section */}
      {isExternalFeedbackEnabled() && (
        <div className="p-5 border rounded-xl bg-white space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Externe Beoordelaars</h2>
            <button
              onClick={() => setShowInviteModal(true)}
              className="rounded-lg bg-emerald-600 text-white text-sm px-3 py-1.5 hover:bg-emerald-700 transition-colors"
            >
              Nodig Externen Uit
            </button>
          </div>
          
          {/* External Invites List - Expandable */}
          <div>
            <button
              onClick={() => setExpandedInvites(!expandedInvites)}
              className="text-sm text-blue-700 underline flex items-center gap-1 hover:text-blue-900"
            >
              <span>{expandedInvites ? "▼" : "▶"}</span> Bekijk Uitnodigingen
            </button>
            {expandedInvites && (
              <div className="mt-3">
                <ExternalInviteList
                  windowId={windowId}
                  subjectUserId={userId}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Competency Scores */}
      <div className="p-5 border rounded-xl bg-white">
        <h2 className="text-xl font-semibold mb-4">Competentiescores</h2>
        <div className="space-y-3">
          {overview.scores.map((score) => {
            const finalRubricLevel = getRubricLevelInfo(score.competency_id, score.final_score);
            
            return (
              <div
                key={score.competency_id}
                className="p-4 bg-gray-50 rounded-lg space-y-3"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg">{score.competency_name}</h3>
                  <div className="flex items-center gap-4">
                    {score.self_score !== null && score.self_score !== undefined && (
                      <div className="text-center">
                        <div className="text-xs text-gray-600 mb-1">Zelf</div>
                        <span className="px-3 py-1 rounded bg-blue-100 text-blue-700 text-sm font-semibold">
                          {score.self_score.toFixed(1)}
                        </span>
                      </div>
                    )}
                    {score.teacher_score !== null && score.teacher_score !== undefined && (
                      <div className="text-center">
                        <div className="text-xs text-gray-600 mb-1">Docent</div>
                        <span className="px-3 py-1 rounded bg-purple-100 text-purple-700 text-sm font-semibold">
                          {score.teacher_score.toFixed(1)}
                        </span>
                      </div>
                    )}
                    {score.external_score !== null && score.external_score !== undefined && (
                      <div className="text-center">
                        <div className="text-xs text-gray-600 mb-1">
                          Extern ({score.external_count})
                        </div>
                        <span className="px-3 py-1 rounded bg-green-100 text-green-700 text-sm font-semibold">
                          {score.external_score.toFixed(1)}
                        </span>
                      </div>
                    )}
                    {score.final_score !== null && score.final_score !== undefined && (
                      <div className="text-center">
                        <div className="text-xs text-gray-600 mb-1">Totaal</div>
                        <span
                          className={`px-3 py-1 rounded text-sm font-semibold ${
                            score.final_score >= 4
                              ? "bg-green-100 text-green-700"
                              : score.final_score >= 3
                              ? "bg-blue-100 text-blue-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {score.final_score.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rubric Level Info */}
                {finalRubricLevel && (
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                          {finalRubricLevel.label || `Niveau ${Math.round(score.final_score || 0)}`}
                        </span>
                      </div>
                      {finalRubricLevel.description && (
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {finalRubricLevel.description}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Goals */}
      {overview.goals.length > 0 && (
        <div className="p-5 border rounded-xl bg-white">
          <h2 className="text-xl font-semibold mb-4">Leerdoelen</h2>
          <div className="space-y-3">
            {overview.goals.map((goal) => (
              <div
                key={goal.id}
                className="p-4 bg-purple-50 border border-purple-200 rounded-lg"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">{goal.goal_text}</h3>
                    {goal.success_criteria && (
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Succescriterium:</span>{" "}
                        {goal.success_criteria}
                      </p>
                    )}
                    {goal.submitted_at && (
                      <p className="text-xs text-gray-500">
                        Ingediend op:{" "}
                        {new Date(goal.submitted_at).toLocaleDateString("nl-NL")}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap ${
                      goal.status === "achieved"
                        ? "bg-green-100 text-green-700"
                        : goal.status === "not_achieved"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {goal.status === "achieved"
                      ? "Behaald"
                      : goal.status === "not_achieved"
                      ? "Niet behaald"
                      : "Bezig"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reflection */}
      {overview.reflection && (
        <div className="p-5 border rounded-xl bg-white">
          <h2 className="text-xl font-semibold mb-4">Reflectie</h2>
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
            <div>
              <p className="text-gray-700 whitespace-pre-wrap">
                {overview.reflection.text}
              </p>
            </div>
            
            {overview.reflection.goal_achieved !== null && (
              <div className="pt-3 border-t border-indigo-200">
                <span className="text-sm text-gray-600">Doel behaald: </span>
                <span
                  className={`text-sm font-semibold ${
                    overview.reflection.goal_achieved
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {overview.reflection.goal_achieved ? "Ja" : "Nee"}
                </span>
              </div>
            )}
            
            {overview.reflection.evidence && (
              <div className="pt-3 border-t border-indigo-200">
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">Bewijs/Voorbeelden:</span>
                </p>
                <p className="text-sm text-gray-700">
                  {overview.reflection.evidence}
                </p>
              </div>
            )}
            
            {overview.reflection.submitted_at && (
              <div className="pt-3 border-t border-indigo-200">
                <p className="text-xs text-gray-500">
                  Ingediend op:{" "}
                  {new Date(overview.reflection.submitted_at).toLocaleDateString(
                    "nl-NL"
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No data message */}
      {overview.scores.every((s) => s.self_score === null) &&
        overview.goals.length === 0 &&
        !overview.reflection && (
          <div className="p-8 border rounded-xl bg-gray-50 text-center">
            <p className="text-gray-500">
              Deze leerling heeft nog geen competentiedata ingevoerd voor dit
              venster.
            </p>
          </div>
        )}

      {/* External Invite Modal */}
      {showInviteModal && (
        <ExternalInviteModal
          windowId={windowId}
          subjectUserId={userId}
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </main>
  );
}
