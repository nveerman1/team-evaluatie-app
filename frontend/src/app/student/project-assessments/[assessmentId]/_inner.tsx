"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentDetailOut } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

// Component for rendering a single rubric criterion with matrix view
function RubricMatrixRow({
  name,
  score,
  levels,
  comment,
}: {
  name: string;
  score: number | null;
  levels: string[];
  comment?: string;
}) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-3">{name}</h3>
      <div className="grid grid-cols-5 gap-2 mb-4">
        {levels.map((levelText, index) => {
          const levelNumber = index + 1;
          const isSelected = score === levelNumber;
          return (
            <div
              key={levelNumber}
              className={`p-3 border rounded-lg text-sm ${
                isSelected
                  ? "bg-blue-100 border-blue-500 border-2 font-medium"
                  : "bg-white border-gray-300"
              }`}
            >
              <div className="font-semibold mb-1 text-center">Niveau {levelNumber}</div>
              <div className="text-xs text-gray-700">{levelText || "—"}</div>
            </div>
          );
        })}
      </div>
      {comment && (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-1">Opmerking docent:</p>
          <p className="text-sm text-gray-600">{comment}</p>
        </div>
      )}
    </div>
  );
}

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

  const handleDownloadPDF = () => {
    window.print();
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
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header with project info */}
      <div className="bg-white border rounded-2xl p-6">
        <h1 className="text-3xl font-bold mb-2">{data.assessment.title}</h1>
        <p className="text-lg text-gray-700 mb-4">{data.rubric_title}</p>
        <div className="flex gap-6 text-sm text-gray-600">
          {data.teacher_name && (
            <div>
              <span className="font-medium">Beoordeeld door:</span> {data.teacher_name}
            </div>
          )}
          {data.assessment.published_at && (
            <div>
              <span className="font-medium">Datum:</span>{" "}
              {new Date(data.assessment.published_at).toLocaleDateString("nl-NL")}
            </div>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="p-3 rounded-lg bg-green-50 text-green-700 flex items-center gap-2">
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700">{error}</div>
      )}

      {/* Rubric matrices - one per criterion */}
      <div className="bg-white border rounded-2xl p-6">
        {data.criteria.map((criterion) => {
          const scoreData = scoreMap[criterion.id];
          // Get all level descriptions for this criterion
          const levels: string[] = [];
          for (let i = data.rubric_scale_min; i <= data.rubric_scale_max; i++) {
            const levelKey = `level${i}`;
            levels.push(criterion.descriptors[levelKey] || "");
          }
          
          return (
            <RubricMatrixRow
              key={criterion.id}
              name={criterion.name}
              score={scoreData?.score ?? null}
              levels={levels}
              comment={scoreData?.comment}
            />
          );
        })}
      </div>

      {/* Total Score and Grade */}
      {data.total_score != null && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
          <h2 className="text-2xl font-bold mb-4">Eindresultaat</h2>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm text-gray-600 mb-1">Totaalscore</p>
              <p className="text-5xl font-bold text-blue-600">
                {data.total_score?.toFixed(1)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                van {data.rubric_scale_min} - {data.rubric_scale_max}
              </p>
            </div>
            {data.grade != null && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Eindcijfer</p>
                <p className="text-5xl font-bold text-indigo-600">
                  {data.grade?.toFixed(1)}
                </p>
                <p className="text-sm text-gray-500 mt-1">schaal 1-10</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reflection Section */}
      <div className="bg-white border rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-2">Jouw reflectie</h2>
        <p className="text-sm text-gray-600 mb-4">
          Beschrijf kort wat je hebt geleerd en wat je meeneemt naar het volgende project.
        </p>

        {data.reflection && (
          <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700 mb-4">
            Reflectie opgeslagen op{" "}
            {data.reflection.submitted_at
              ? new Date(data.reflection.submitted_at).toLocaleDateString("nl-NL")
              : "onbekende datum"}
          </div>
        )}

        <textarea
          className="w-full border rounded-lg px-4 py-3 min-h-32 mb-2"
          value={reflectionText}
          onChange={(e) => setReflectionText(e.target.value)}
          placeholder="Jouw reflectie..."
        />
        <p className="text-sm text-gray-500 mb-4">
          {reflectionText.split(/\s+/).filter((w) => w).length} woorden
        </p>

        <button
          onClick={handleSaveReflection}
          disabled={saving || !reflectionText.trim()}
          className="px-6 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60 hover:bg-blue-700 transition-colors"
        >
          {saving ? "Opslaan…" : "Reflectie opslaan"}
        </button>
      </div>

      {/* PDF Download Button */}
      <div className="flex justify-center">
        <button
          onClick={handleDownloadPDF}
          className="px-6 py-3 rounded-lg bg-gray-800 text-white hover:bg-gray-900 transition-colors"
        >
          Download beoordeling als PDF
        </button>
      </div>
    </main>
  );
}
