"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentReflectionsOverview } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

export default function ProjectAssessmentReflectionsInner() {
  const params = useParams();
  const router = useRouter();
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

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Geen data gevonden" />;

  const tabs = [
    { id: "overzicht", label: "Overzicht", href: `/teacher/project-assessments/${assessmentId}/overview` },
    { id: "scores", label: "Scores", href: `/teacher/project-assessments/${assessmentId}/scores` },
    { id: "reflecties", label: "Reflecties", href: `/teacher/project-assessments/${assessmentId}/reflections` },
    { id: "bewerken", label: "Bewerken", href: `/teacher/project-assessments/${assessmentId}/edit` },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <div className="mb-4">
            <Link
              href={`/teacher/project-assessments/${assessmentId}/overview`}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Terug naar overzicht
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
            {data.assessment.title} – Reflecties
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Team: {data.group_name} • {data.reflections.length} reflectie(s)
          </p>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Tabs Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    tab.id === "reflecties"
                      ? "border-black text-black"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
                aria-current={tab.id === "reflecties" ? "page" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
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
      </div>
    </>
  );
}
