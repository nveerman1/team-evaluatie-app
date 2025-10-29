"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentDetailOut } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

export default function StudentProjectAssessmentInner() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = Number(params?.assessmentId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [data, setData] = useState<ProjectAssessmentDetailOut | null>(null);
  const [reflectionText, setReflectionText] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result =
          await projectAssessmentService.getProjectAssessment(assessmentId);
        setData(result);
        if (result.reflection) {
          setReflectionText(result.reflection.text);
        }
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [assessmentId]);

  const handleSaveReflection = async () => {
    if (!reflectionText.trim()) {
      setError("Vul een reflectie in");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await projectAssessmentService.createOrUpdateReflection(assessmentId, {
        text: reflectionText,
      });
      setSuccessMsg("Reflectie opgeslagen");
      // Reload data to get updated reflection
      const result =
        await projectAssessmentService.getProjectAssessment(assessmentId);
      setData(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Geen data gevonden" />;

  // Get score for each criterion
  const scoreMap: Record<number, { score: number; comment?: string }> = {};
  data.scores.forEach((s) => {
    scoreMap[s.criterion_id] = { score: s.score, comment: s.comment || undefined };
  });

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{data.assessment.title}</h1>
          <p className="text-gray-600">{data.rubric_title}</p>
          {data.assessment.version && (
            <p className="text-sm text-gray-500">
              Versie: {data.assessment.version}
            </p>
          )}
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-xl border"
        >
          Terug
        </button>
      </header>

      {successMsg && (
        <div className="p-3 rounded-lg bg-green-50 text-green-700">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700">{error}</div>
      )}

      {/* Assessment Info */}
      <section className="bg-white border rounded-2xl p-5">
        <h2 className="text-lg font-semibold mb-3">Beoordeling</h2>
        <p className="text-sm text-gray-600 mb-4">
          Schaal: {data.rubric_scale_min} - {data.rubric_scale_max}
        </p>

        <div className="space-y-6">
          {data.criteria.map((criterion) => {
            const scoreData = scoreMap[criterion.id];
            return (
              <div
                key={criterion.id}
                className="border-t pt-4 first:border-t-0 first:pt-0"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-lg">{criterion.name}</h3>
                  {scoreData && (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-blue-600">
                        {scoreData.score}
                      </span>
                      <span className="text-gray-500">
                        / {data.rubric_scale_max}
                      </span>
                    </div>
                  )}
                </div>
                {scoreData?.comment && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Opmerking:
                    </p>
                    <p className="text-sm text-gray-600">{scoreData.comment}</p>
                  </div>
                )}
                {!scoreData && (
                  <p className="text-sm text-gray-400 italic">
                    Nog geen score voor dit criterium
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Reflection Section */}
      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Jouw reflectie</h2>
          <p className="text-sm text-gray-600">
            Wat ga je meenemen naar het volgende project? Wat heb je geleerd?
          </p>
        </div>

        {data.reflection && (
          <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            <p>
              Je reflectie is opgeslagen op{" "}
              {data.reflection.submitted_at
                ? new Date(data.reflection.submitted_at).toLocaleString("nl-NL")
                : "onbekende datum"}{" "}
              ({data.reflection.word_count} woorden)
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Reflectie{" "}
            {!data.reflection && <span className="text-red-500">*</span>}
          </label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 min-h-40"
            value={reflectionText}
            onChange={(e) => setReflectionText(e.target.value)}
            placeholder="Beschrijf wat je hebt geleerd en wat je meeneemt naar het volgende project..."
          />
          <p className="text-sm text-gray-500">
            {reflectionText.split(/\s+/).filter((w) => w).length} woorden
          </p>
        </div>

        <button
          onClick={handleSaveReflection}
          disabled={saving || !reflectionText.trim()}
          className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
        >
          {saving
            ? "Opslaan…"
            : data.reflection
            ? "Reflectie bijwerken"
            : "Reflectie opslaan"}
        </button>
      </section>
    </main>
  );
}
