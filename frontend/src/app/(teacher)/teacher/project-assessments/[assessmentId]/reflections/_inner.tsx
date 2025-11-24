"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentReflectionsOverview } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

export default function ProjectAssessmentReflectionsInner() {
  const params = useParams();
  const assessmentId = Number(params?.assessmentId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProjectAssessmentReflectionsOverview | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await projectAssessmentService.getReflections(assessmentId);
        setData(result);
      } catch (e: unknown) {
        if (e instanceof ApiAuthError) {
          setError(e.originalMessage);
        } else {
          const err = e as { response?: { data?: { detail?: string } }; message?: string };
          setError(err?.response?.data?.detail || err?.message || "Laden mislukt");
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [assessmentId]);

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Geen data gevonden" />;

  return (
    <>
      {/* Info bar */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
        <p className="text-gray-600 text-sm">
          Team: {data.group_name} • {data.reflections.length} reflectie(s)
        </p>
      </div>

      {/* Reflections List */}
      {data.reflections.length === 0 && (
        <div className="bg-white border rounded-2xl p-8 text-center text-gray-500">
          <p>Nog geen reflecties ingediend door studenten.</p>
        </div>
      )}

      {data.reflections.length > 0 && (
        <div className="space-y-4">
        {data.reflections.map((reflection) => (
          <section
            key={reflection.id}
            className="bg-white border rounded-2xl p-5 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{reflection.user_name}</h3>
                <p className="text-sm text-gray-500">
                  {reflection.submitted_at
                    ? new Date(reflection.submitted_at).toLocaleString("nl-NL")
                    : "Datum onbekend"}{" "}
                  • {reflection.word_count} woorden
                </p>
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="text-gray-700 whitespace-pre-wrap">
                {reflection.text}
              </p>
            </div>
          </section>
        ))}
      </div>
      )}
    </>
  );
}
