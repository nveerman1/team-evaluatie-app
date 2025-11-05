"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import {
  ProjectAssessmentDetailOut,
  ProjectAssessmentScoreCreate,
  ProjectAssessmentUpdate,
  ProjectAssessmentTeamOverview,
} from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { RubricRating } from "@/components/teacher/RubricRating";

export default function EditProjectAssessmentInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentId = Number(params?.assessmentId);
  const teamNumber = searchParams.get("team") ? Number(searchParams.get("team")) : undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [data, setData] = useState<ProjectAssessmentDetailOut | null>(null);
  const [teamsData, setTeamsData] = useState<ProjectAssessmentTeamOverview | null>(null);
  const [status, setStatus] = useState("draft");
  const [generalComment, setGeneralComment] = useState("");

  // Scores: map criterion_id -> {score, comment}
  const [scores, setScores] = useState<
    Record<number, { score: number; comment: string }>
  >({});

  // Autosave timer
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load teams overview to get team list
  useEffect(() => {
    async function loadTeams() {
      try {
        const result = await projectAssessmentService.getTeamOverview(assessmentId);
        setTeamsData(result);
        // If no team selected and teams exist, redirect to first team
        if (!teamNumber && result.teams.length > 0 && result.teams[0].team_number) {
          const firstTeam = result.teams[0].team_number;
          router.replace(`/teacher/project-assessments/${assessmentId}/edit?team=${firstTeam}`);
        }
      } catch (e) {
        console.error("Failed to load teams", e);
      }
    }
    loadTeams();
  }, [assessmentId, teamNumber, router]);

  // Load assessment data for specific team
  useEffect(() => {
    if (teamNumber === undefined) return;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await projectAssessmentService.getProjectAssessment(
          assessmentId,
          teamNumber
        );
        setData(result);
        setStatus(result.assessment.status);

        // Initialize scores
        const scoresMap: Record<number, { score: number; comment: string }> = {};
        result.scores.forEach((s) => {
          scoresMap[s.criterion_id] = {
            score: s.score,
            comment: s.comment || "",
          };
        });
        setScores(scoresMap);
      } catch (e: any) {
        if (e instanceof ApiAuthError) {
          setError(e.originalMessage);
        } else {
          setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [assessmentId, teamNumber]);

  // Autosave function
  const autoSaveScores = useCallback(async () => {
    if (!data || teamNumber === undefined) return;
    setAutoSaving(true);
    try {
      const scoresPayload: ProjectAssessmentScoreCreate[] = Object.entries(scores).map(
        ([criterionId, data]) => ({
          criterion_id: Number(criterionId),
          score: data.score,
          comment: data.comment || undefined,
          team_number: teamNumber,
        })
      );

      await projectAssessmentService.batchUpdateScores(assessmentId, {
        scores: scoresPayload,
      });
    } catch (e: any) {
      console.error("Auto-save failed", e);
    } finally {
      setAutoSaving(false);
    }
  }, [scores, assessmentId, data, teamNumber]);

  // Trigger autosave when scores change
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    if (Object.keys(scores).length > 0 && teamNumber !== undefined) {
      autoSaveTimerRef.current = setTimeout(() => {
        autoSaveScores();
      }, 2000); // 2 seconds delay
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [scores, autoSaveScores, teamNumber]);

  const handleSaveScores = async () => {
    if (teamNumber === undefined) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const scoresPayload: ProjectAssessmentScoreCreate[] = Object.entries(scores).map(
        ([criterionId, data]) => ({
          criterion_id: Number(criterionId),
          score: data.score,
          comment: data.comment || undefined,
          team_number: teamNumber,
        })
      );

      await projectAssessmentService.batchUpdateScores(assessmentId, {
        scores: scoresPayload,
      });
      setSuccessMsg("Scores opgeslagen");
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        setError(e?.response?.data?.detail || e?.message || "Opslaan mislukt");
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (
      !confirm(
        "Weet je zeker dat je deze projectbeoordeling wilt publiceren? Studenten kunnen deze dan inzien."
      )
    )
      return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await projectAssessmentService.updateProjectAssessment(assessmentId, {
        status: "published",
      });
      setStatus("published");
      setSuccessMsg("Projectbeoordeling gepubliceerd");
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        setError(e?.response?.data?.detail || e?.message || "Publiceren mislukt");
      }
    } finally {
      setSaving(false);
    }
  };

  // Navigation functions
  const navigateToTeam = (newTeamNumber: number) => {
    router.push(`/teacher/project-assessments/${assessmentId}/edit?team=${newTeamNumber}`);
  };

  const currentTeamIndex = teamsData?.teams.findIndex(t => t.team_number === teamNumber) ?? -1;
  const hasPrevTeam = currentTeamIndex > 0;
  const hasNextTeam = teamsData ? currentTeamIndex < teamsData.teams.length - 1 : false;
  const prevTeamNumber = hasPrevTeam && teamsData ? teamsData.teams[currentTeamIndex - 1].team_number : null;
  const nextTeamNumber = hasNextTeam && teamsData ? teamsData.teams[currentTeamIndex + 1].team_number : null;

  const currentTeam = teamsData?.teams.find(t => t.team_number === teamNumber);

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data || !currentTeam) return <ErrorMessage message="Geen data gevonden" />;

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/teacher/project-assessments/${assessmentId}/overview`}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Terug naar overzicht
          </Link>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              Rubric invullen: Team {teamNumber}
            </h1>
            <p className="text-gray-600">
              {data.rubric_title} • Schaal: {data.rubric_scale_min}-{data.rubric_scale_max}
            </p>
            <div className="mt-2 text-sm text-gray-600">
              <strong>Teamleden:</strong> {currentTeam.members.map(m => m.name).join(", ")}
            </div>
            {autoSaving && (
              <p className="text-sm text-blue-600">💾 Autosave actief...</p>
            )}
          </div>
          <div className="flex gap-2">
            {status === "draft" && (
              <button
                onClick={handlePublish}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-green-600 text-white hover:opacity-90 disabled:opacity-60"
              >
                ✅ Publiceer voor studenten
              </button>
            )}
            {status === "published" && (
              <span className="px-4 py-2 rounded-xl bg-green-100 text-green-700">
                ✅ Gepubliceerd
              </span>
            )}
          </div>
        </div>

        {/* Team Navigation */}
        <div className="flex items-center justify-between bg-white border rounded-xl p-4">
          <button
            onClick={() => prevTeamNumber && navigateToTeam(prevTeamNumber)}
            disabled={!hasPrevTeam}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Vorig team
          </button>
          <div className="text-center">
            <div className="font-semibold">Team {teamNumber}</div>
            <div className="text-sm text-gray-500">
              {currentTeamIndex + 1} van {teamsData?.teams.length || 0}
            </div>
          </div>
          <button
            onClick={() => nextTeamNumber && navigateToTeam(nextTeamNumber)}
            disabled={!hasNextTeam}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Volgend team →
          </button>
        </div>
      </header>

      {successMsg && (
        <div className="p-3 rounded-lg bg-green-50 text-green-700 flex items-center gap-2">
          ✅ {successMsg}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700">{error}</div>
      )}

      {/* Rubric Categories Section */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Rubric per categorie</h2>
          <div className="text-sm text-gray-500">
            {status === "draft" ? (
              "💾 Autosave: wijzigingen worden automatisch opgeslagen"
            ) : (
              "✅ Gepubliceerd - studenten kunnen dit zien"
            )}
          </div>
        </div>

        {/* Criteria grouped by category */}
        {(() => {
          // Group criteria by category
          const grouped = data.criteria.reduce((acc, c) => {
            const cat = c.category || "Overig";
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(c);
            return acc;
          }, {} as Record<string, typeof data.criteria>);

          // Render each category with its criteria
          return Object.entries(grouped).map(([category, categoryCriteria]) => (
            <div key={category} className="space-y-4 mb-8">
              {/* Category header */}
              <div className="border-b-2 border-gray-300 pb-2">
                <h3 className="text-xl font-semibold text-gray-800">{category}</h3>
              </div>
              {/* Criteria in this category */}
              {categoryCriteria.map((criterion) => (
                <RubricRating
                  key={criterion.id}
                  criterionName={criterion.name}
                  criterionId={criterion.id}
                  value={scores[criterion.id]?.score || data.rubric_scale_min}
                  comment={scores[criterion.id]?.comment || ""}
                  scaleMin={data.rubric_scale_min}
                  scaleMax={data.rubric_scale_max}
                  descriptors={criterion.descriptors}
                  onChange={(newScore) => {
                    setScores((prev) => ({
                      ...prev,
                      [criterion.id]: {
                        score: newScore,
                        comment: prev[criterion.id]?.comment || "",
                      },
                    }));
                  }}
                  onCommentChange={(newComment) => {
                    setScores((prev) => ({
                      ...prev,
                      [criterion.id]: {
                        score: prev[criterion.id]?.score || data.rubric_scale_min,
                        comment: newComment,
                      },
                    }));
                  }}
                />
              ))}
            </div>
          ));
        })()}

        {/* General Comment Section */}
        <div className="bg-white border-2 rounded-xl p-5 space-y-3">
          <h3 className="text-lg font-semibold">Algemene opmerking</h3>
          <textarea
            className="w-full border rounded-lg px-3 py-3 min-h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Algemene feedback over het project..."
            value={generalComment}
            onChange={(e) => setGeneralComment(e.target.value)}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t bg-white rounded-xl p-5">
          <div className="text-sm text-gray-600">
            {autoSaving ? (
              <span className="text-blue-600">💾 Opslaan...</span>
            ) : (
              <span>✅ Alle wijzigingen opgeslagen</span>
            )}
          </div>
          <div className="flex gap-3">
            {status === "draft" && (
              <>
                <button
                  onClick={handleSaveScores}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-60"
                >
                  💾 Opslaan als concept
                </button>
                <button
                  onClick={handlePublish}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                >
                  ✅ Publiceren voor studenten
                </button>
              </>
            )}
            {status === "published" && (
              <button
                onClick={handleSaveScores}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-60"
              >
                💾 Wijzigingen opslaan
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
