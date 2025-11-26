"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, ReactNode, useCallback } from "react";
import Link from "next/link";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentTeamOverview } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { ProjectAssessmentTabs } from "@/components/teacher/project-assessments/ProjectAssessmentTabs";

type LayoutProps = {
  children: ReactNode;
};

export default function ProjectAssessmentLayout({ children }: LayoutProps) {
  const params = useParams();
  const assessmentId = params?.assessmentId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProjectAssessmentTeamOverview | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!assessmentId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await projectAssessmentService.getTeamOverview(Number(assessmentId));
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
  }, [assessmentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Show toast notification
  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Toggle publish status
  async function handleTogglePublish() {
    if (!data) return;

    const currentStatus = data.assessment.status;
    const newStatus = currentStatus === "published" ? "draft" : "published";
    
    setPublishing(true);
    try {
      await projectAssessmentService.updateProjectAssessment(Number(assessmentId), {
        status: newStatus,
      });
      
      // Reload data to get updated status
      await loadData();
      
      showToast(newStatus === "published" ? "Beoordeling gepubliceerd" : "Beoordeling teruggezet naar concept");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      showToast(err?.response?.data?.detail || err?.message || "Status wijzigen mislukt");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Geen data gevonden" />;

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <div className="mb-4">
            <Link
              href="/teacher/project-assessments"
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Terug naar overzicht
            </Link>
          </div>
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
                {data.assessment.title}
              </h1>
              <p className="text-gray-600 mt-1 text-sm">
                Rubric: {data.rubric_title} (schaal {data.rubric_scale_min}-{data.rubric_scale_max})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePublish}
                disabled={publishing}
                className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-60 ${
                  data.assessment.status === "published"
                    ? "bg-amber-500 text-white hover:bg-amber-600"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {publishing ? "..." : data.assessment.status === "published" ? "📝 Concept" : "✅ Publiceer"}
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Tabs Navigation */}
        <ProjectAssessmentTabs assessmentId={assessmentId} />

        {/* Page-specific content */}
        {children}
      </div>
    </>
  );
}
