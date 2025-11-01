"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ApiAuthError } from "@/lib/api";
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
      setSuccessMsg("Reflectie opgeslagen ✓");
      // Reload data to get updated reflection
      const result =
        await projectAssessmentService.getProjectAssessment(assessmentId);
      setData(result);
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

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Geen data gevonden" />;

  // Get score for each criterion
  const scoreMap: Record<number, { score: number; comment?: string }> = {};
  data.scores.forEach((s) => {
    scoreMap[s.criterion_id] = { score: s.score, comment: s.comment || undefined };
  });

  // Helper function to get level description based on score
  const getLevelDescription = (criterion: typeof data.criteria[0], score: number): string | null => {
    // Assuming descriptors are keyed like "level1", "level2", etc.
    // Map score to level based on rubric scale
    const levelKey = `level${score}`;
    return criterion.descriptors[levelKey] || null;
  };

  // Calculate reflection status
  const reflectionStatus = data.reflection ? "Ingeleverd" : "Nog niet gereflecteerd";

  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{data.assessment.title}</h1>
          <p className="text-gray-600">{data.rubric_title}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 rounded-xl border hover:bg-gray-50"
          >
            📥 Download beoordeling (PDF)
          </button>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-xl border"
          >
            Terug
          </button>
        </div>
      </header>

      {successMsg && (
        <div className="p-3 rounded-lg bg-green-50 text-green-700 flex items-center gap-2">
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700">{error}</div>
      )}

      {/* Assessment Metadata */}
      <section className="bg-white border rounded-2xl p-5">
        <h2 className="text-lg font-semibold mb-3">Beoordelingsinformatie</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.teacher_name && (
            <div>
              <p className="text-sm text-gray-600">Beoordeeld door:</p>
              <p className="font-medium">{data.teacher_name}</p>
            </div>
          )}
          {data.assessment.published_at && (
            <div>
              <p className="text-sm text-gray-600">Datum:</p>
              <p className="font-medium">
                {new Date(data.assessment.published_at).toLocaleDateString("nl-NL")}
              </p>
            </div>
          )}
          {data.assessment.version && (
            <div>
              <p className="text-sm text-gray-600">Versie:</p>
              <p className="font-medium">{data.assessment.version}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Status reflectie:</p>
            <p className={`font-medium ${data.reflection ? 'text-green-600' : 'text-orange-600'}`}>
              {reflectionStatus}
            </p>
          </div>
        </div>
      </section>

      {/* Total Score and Grade */}
      {(data.total_score !== null && data.total_score !== undefined) && (
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-3">Eindresultaat</h2>
          <div className="flex items-center justify-around">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Totaalscore</p>
              <p className="text-4xl font-bold text-blue-600">
                {data.total_score.toFixed(1)}
              </p>
              <p className="text-sm text-gray-500">
                van {data.rubric_scale_min} - {data.rubric_scale_max}
              </p>
            </div>
            {data.grade !== null && data.grade !== undefined && (
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Eindcijfer</p>
                <p className="text-4xl font-bold text-indigo-600">
                  {data.grade.toFixed(1)}
                </p>
                <p className="text-sm text-gray-500">schaal 1-10</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Rubric Detail View */}
      <section className="bg-white border rounded-2xl p-5">
        <h2 className="text-lg font-semibold mb-3">Rubric-detailweergave</h2>
        <p className="text-sm text-gray-600 mb-4">
          Per criterium: de gekozen niveauomschrijving en score
        </p>

        <div className="space-y-6">
          {data.criteria.map((criterion) => {
            const scoreData = scoreMap[criterion.id];
            const levelDescription = scoreData ? getLevelDescription(criterion, scoreData.score) : null;
            
            return (
              <div
                key={criterion.id}
                className="border rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-lg">{criterion.name}</h3>
                    <p className="text-xs text-gray-500">Weging: {criterion.weight}</p>
                  </div>
                  {scoreData && (
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-3xl font-bold text-blue-600">
                        {scoreData.score}
                      </span>
                      <span className="text-gray-500">
                        / {data.rubric_scale_max}
                      </span>
                    </div>
                  )}
                </div>
                
                {levelDescription && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      Geselecteerd niveau:
                    </p>
                    <p className="text-sm text-blue-800">{levelDescription}</p>
                  </div>
                )}
                
                {scoreData?.comment && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Toelichting van docent:
                    </p>
                    <p className="text-sm text-gray-600">{scoreData.comment}</p>
                  </div>
                )}
                
                {!scoreData && (
                  <p className="text-sm text-gray-400 italic mt-2">
                    Nog geen score voor dit criterium
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Rubric Matrix View */}
      <section className="bg-white border rounded-2xl p-5 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-3">Rubric-matrixweergave</h2>
        <p className="text-sm text-gray-600 mb-4">
          Overzicht van alle niveaus met geselecteerde scores gemarkeerd
        </p>
        
        <div className="min-w-max">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-3 text-left font-semibold">Criterium</th>
                {Array.from(
                  { length: data.rubric_scale_max - data.rubric_scale_min + 1 },
                  (_, i) => data.rubric_scale_min + i
                ).map((level) => (
                  <th key={level} className="border p-3 text-center font-semibold min-w-[120px]">
                    Niveau {level}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.criteria.map((criterion) => {
                const scoreData = scoreMap[criterion.id];
                
                return (
                  <tr key={criterion.id} className="hover:bg-gray-50">
                    <td className="border p-3 font-medium">{criterion.name}</td>
                    {Array.from(
                      { length: data.rubric_scale_max - data.rubric_scale_min + 1 },
                      (_, i) => data.rubric_scale_min + i
                    ).map((level) => {
                      const levelKey = `level${level}`;
                      const description = criterion.descriptors[levelKey] || "";
                      const isSelected = scoreData?.score === level;
                      
                      return (
                        <td
                          key={level}
                          className={`border p-3 text-sm ${
                            isSelected
                              ? "bg-blue-100 border-blue-500 border-2 font-medium"
                              : ""
                          }`}
                        >
                          {isSelected && (
                            <div className="flex items-center justify-center mb-2">
                              <span className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                                ✓ GESELECTEERD
                              </span>
                            </div>
                          )}
                          {description || "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Reflection Section */}
      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Jouw reflectie</h2>
            <p className="text-sm text-gray-600">
              Wat ga je meenemen naar het volgende project? Wat heb je geleerd?
            </p>
          </div>
          {data.reflection && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              <span>✓</span>
              <span>Ingeleverd</span>
            </div>
          )}
          {!data.reflection && (
            <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
              <span>⚠</span>
              <span>Nog niet gereflecteerd</span>
            </div>
          )}
        </div>

        {data.reflection && (
          <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex items-start gap-2">
            <span className="text-lg">ℹ️</span>
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
          className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60 hover:bg-gray-800 transition-colors"
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
