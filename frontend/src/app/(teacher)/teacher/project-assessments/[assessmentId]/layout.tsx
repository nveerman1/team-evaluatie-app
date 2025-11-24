"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, ReactNode } from "react";
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

  useEffect(() => {
    async function loadData() {
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
    }
    loadData();
  }, [assessmentId]);

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Geen data gevonden" />;

  return (
    <>
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
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
            {data.assessment.title}
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Rubric: {data.rubric_title} (schaal {data.rubric_scale_min}-{data.rubric_scale_max})
          </p>
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
