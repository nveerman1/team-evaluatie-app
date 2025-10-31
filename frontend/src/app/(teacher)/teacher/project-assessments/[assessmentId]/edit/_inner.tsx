"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [data, setData] = useState<ProjectAssessmentDetailOut | null>(null);
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [status, setStatus] = useState("draft");

  // Scores: map criterion_id -> {score, comment}
  const [scores, setScores] = useState<
    Record<number, { score: number; comment: string }>
  >({});

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

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projectbeoordeling bewerken</h1>
          <p className="text-gray-600">
            {data.rubric_title} - {data.assessment.title}
          </p>
        </div>
        <div className="flex gap-2">
          {status === "draft" && (
            <button
              onClick={handlePublish}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-green-600 text-white hover:opacity-90 disabled:opacity-60"
            >
              Publiceer
            </button>
          )}
          <a
            href="/teacher/project-assessments"
            className="px-4 py-2 rounded-xl border"
          >
            Terug
          </a>
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

      {/* Basic Info Section */}
      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <h2 className="text-lg font-semibold">Basisgegevens</h2>
        <div className="space-y-1">
          <label className="block text-sm font-medium">Titel</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium">Versie</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium">Status</label>
          <div className="flex items-center gap-2">
            {status === "draft" ? (
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                Concept
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">
                Gepubliceerd
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleUpdateInfo}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
        >
          {saving ? "Opslaan…" : "Opslaan"}
        </button>
      </section>

      {/* Scores Section */}
      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <h2 className="text-lg font-semibold">Scores</h2>
        <p className="text-sm text-gray-600">
          Schaal: {data.rubric_scale_min} - {data.rubric_scale_max}
        </p>

        {data.criteria.map((criterion) => (
          <div key={criterion.id} className="border-t pt-4 space-y-3">
            <h3 className="font-medium">{criterion.name}</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium">Score</label>
                <input
                  type="number"
                  min={data.rubric_scale_min}
                  max={data.rubric_scale_max}
                  className="w-full border rounded-lg px-3 py-2"
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
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">
                  Opmerking (optioneel)
                </label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 min-h-20"
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
          </div>
        ))}

        <button
          onClick={handleSaveScores}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
        >
          {saving ? "Opslaan…" : "Scores opslaan"}
        </button>
      </section>
    </main>
  );
}
