"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import {
  ProjectAssessmentDetailOut,
  ProjectAssessmentScoreCreate,
  ProjectAssessmentUpdate,
} from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

export default function EditProjectAssessmentInner() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = Number(params?.assessmentId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [data, setData] = useState<ProjectAssessmentDetailOut | null>(null);
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [status, setStatus] = useState("draft");
  const [generalComment, setGeneralComment] = useState("");
  const [expandedCriteria, setExpandedCriteria] = useState<Record<number, boolean>>({});

  // Scores: map criterion_id -> {score, comment}
  const [scores, setScores] = useState<
    Record<number, { score: number; comment: string }>
  >({});

  // Autosave timer
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result =
          await projectAssessmentService.getProjectAssessment(assessmentId);
        setData(result);
        setTitle(result.assessment.title);
        setVersion(result.assessment.version || "");
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
  }, [assessmentId]);

  const handleUpdateInfo = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const payload: ProjectAssessmentUpdate = {
        title,
        version: version || undefined,
        status,
      };
      await projectAssessmentService.updateProjectAssessment(
        assessmentId,
        payload
      );
      setSuccessMsg("Basisgegevens opgeslagen");
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

  // Autosave function
  const autoSaveScores = useCallback(async () => {
    if (!data) return;
    setAutoSaving(true);
    try {
      const scoresPayload: ProjectAssessmentScoreCreate[] = Object.entries(
        scores
      ).map(([criterionId, data]) => ({
        criterion_id: Number(criterionId),
        score: data.score,
        comment: data.comment || undefined,
      }));

      await projectAssessmentService.batchUpdateScores(assessmentId, {
        scores: scoresPayload,
      });
    } catch (e: any) {
      console.error("Auto-save failed", e);
    } finally {
      setAutoSaving(false);
    }
  }, [scores, assessmentId, data]);

  // Trigger autosave when scores change
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    if (Object.keys(scores).length > 0) {
      autoSaveTimerRef.current = setTimeout(() => {
        autoSaveScores();
      }, 2000); // 2 seconds delay
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [scores, autoSaveScores]);

  const handleSaveScores = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const scoresPayload: ProjectAssessmentScoreCreate[] = Object.entries(
        scores
      ).map(([criterionId, data]) => ({
        criterion_id: Number(criterionId),
        score: data.score,
        comment: data.comment || undefined,
      }));

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
        setError(
          e?.response?.data?.detail || e?.message || "Publiceren mislukt"
        );
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Geen data gevonden" />;

  // Get group info from assessment
  const groupId = data.assessment.group_id;

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
              Rubric invullen: {data.assessment.title}
            </h1>
            <p className="text-gray-600">
              {data.rubric_title} • Schaal: {data.rubric_scale_min}-
              {data.rubric_scale_max}
            </p>
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
            <button
              onClick={() => {
                setError(null);
                setSuccessMsg("PDF download functie komt binnenkort beschikbaar");
              }}
              className="px-4 py-2 rounded-xl border hover:bg-gray-50 opacity-60 cursor-not-allowed"
              title="Deze functie komt binnenkort beschikbaar"
            >
              🧾 Download PDF
            </button>
          </div>
        </div>
      </header>

      {successMsg && (
        <div className="p-3 rounded-lg bg-green-50 text-green-700">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700">{error}</div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg bg-green-50 text-green-700 flex items-center gap-2">
          ✅ {successMsg}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700">{error}</div>
      )}

      {/* Rubric Categories Section */}
      <section className="bg-white border rounded-2xl p-6 space-y-6">
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

        {/* Categories Grid */}
        <div className="grid gap-5">
          {data.criteria.map((criterion, index) => (
            <div
              key={criterion.id}
              className="border-2 rounded-xl p-5 hover:border-blue-300 transition-colors space-y-4"
            >
              {/* Category Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {criterion.name}
                  </h3>
                  {criterion.descriptors && Object.keys(criterion.descriptors).length > 0 && (
                    <div className="mt-1">
                      <button
                        type="button"
                        className="text-sm text-blue-600 hover:text-blue-800"
                        onClick={() => setExpandedCriteria(prev => ({
                          ...prev,
                          [criterion.id]: !prev[criterion.id]
                        }))}
                      >
                        {expandedCriteria[criterion.id] ? "▼" : "▶"} ℹ️ Toelichting
                      </button>
                      {expandedCriteria[criterion.id] && (
                        <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-gray-700">
                          {Object.entries(criterion.descriptors).map(([key, value]) => (
                            <div key={key} className="mb-2 last:mb-0">
                              <strong>{key}:</strong> {value}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-3xl font-bold text-blue-600">
                      {scores[criterion.id]?.score || data.rubric_scale_min}
                    </div>
                    <div className="text-xs text-gray-500">
                      / {data.rubric_scale_max}
                    </div>
                  </div>
                </div>
              </div>

              {/* Score Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Score
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={data.rubric_scale_min}
                    max={data.rubric_scale_max}
                    step="1"
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    value={scores[criterion.id]?.score || data.rubric_scale_min}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setScores((prev) => ({
                        ...prev,
                        [criterion.id]: {
                          score: val,
                          comment: prev[criterion.id]?.comment || "",
                        },
                      }));
                    }}
                  />
                  <input
                    type="number"
                    min={data.rubric_scale_min}
                    max={data.rubric_scale_max}
                    className="w-20 border rounded-lg px-3 py-2 text-center font-semibold"
                    value={scores[criterion.id]?.score || data.rubric_scale_min}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val >= data.rubric_scale_min && val <= data.rubric_scale_max) {
                        setScores((prev) => ({
                          ...prev,
                          [criterion.id]: {
                            score: val,
                            comment: prev[criterion.id]?.comment || "",
                          },
                        }));
                      }
                    }}
                  />
                </div>
              </div>

              {/* Comment Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Opmerking voor student
                </label>
                <textarea
                  className="w-full border rounded-lg px-3 py-3 min-h-28 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Vul hier je feedback in voor deze categorie..."
                  value={scores[criterion.id]?.comment || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setScores((prev) => ({
                      ...prev,
                      [criterion.id]: {
                        score: prev[criterion.id]?.score || data.rubric_scale_min,
                        comment: val,
                      },
                    }));
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* General Comment Section */}
        <div className="border-t pt-6 space-y-3">
          <h3 className="text-lg font-semibold">Algemene opmerking</h3>
          <textarea
            className="w-full border rounded-lg px-3 py-3 min-h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Algemene feedback over het project..."
            value={generalComment}
            onChange={(e) => setGeneralComment(e.target.value)}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
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
