"use client";

import { useMemo } from "react";
import { useStudentProjectAssessments } from "@/hooks/useStudentProjectAssessments";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";
import { ProjectLineChart } from "./components/ProjectLineChart";
import { ProjectRadarChart } from "./components/ProjectRadarChart";
import type { ProjectAssessmentListItem } from "@/dtos/project-assessment.dto";

// KPI Tile component
const KPITile = ({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
}) => {
  return (
    <div className="rounded-xl bg-white border border-gray-300 shadow-sm p-4 flex items-start gap-4">
      <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-2xl">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm text-gray-500 mb-1">{title}</div>
        <div className="text-3xl font-semibold text-gray-900">{value}</div>
        {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
      </div>
    </div>
  );
};

export default function ProjectOverviewPage() {
  const {
    assessments: projectAssessments,
    loading,
    error,
  } = useStudentProjectAssessments();

  // Compute statistics from project assessments
  const stats = useMemo(() => {
    if (!projectAssessments || projectAssessments.length === 0) {
      return {
        avgGrade: 0,
        completedCount: 0,
        categoryAverages: {},
        gradesTrend: [],
      };
    }

    // TODO: Replace mock data with actual grade/score calculations
    // The current DTO (ProjectAssessmentListItem) does not include grade or detailed scores
    // In production, this should:
    // 1. Fetch detailed assessment data for each project (including grades and rubric scores)
    // 2. Calculate actual average grades from assessment details
    // 3. Calculate actual category averages from rubric criterion scores
    // 4. Extract real grade trends from assessment history
    
    const completedCount = projectAssessments.length;
    
    // Mock average grade (would come from actual grade field in detail data)
    const avgGrade = 7.5;
    
    // Mock category averages (would be calculated from rubric criterion scores)
    const categoryAverages = {
      Projectproces: 3.8,
      Eindresultaat: 4.1,
      Communicatie: 3.9,
      Samenwerking: 4.0,
      Professionaliteit: 3.7,
    };

    // Prepare trend data for line chart with deterministic mock grades
    const gradesTrend = projectAssessments.map((assessment, index) => ({
      label: assessment.title.substring(0, 20),
      // TODO: Use actual grade from assessment detail
      grade: 7 + ((index * 37) % 30) / 10, // Deterministic pseudo-random grade between 7.0-10.0
      date: assessment.published_at || "",
    }));

    return {
      avgGrade,
      completedCount,
      categoryAverages,
      gradesTrend,
    };
  }, [projectAssessments]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Loading />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <ErrorMessage message={error} />
        </div>
      </div>
    );
  }

  // Empty state
  if (!projectAssessments || projectAssessments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            Projectoverzicht
          </h1>
          <p className="text-gray-600 mb-8">
            Overzicht van jouw projectbeoordelingen, cijfers en ontwikkeling.
          </p>

          <div className="rounded-xl bg-white border border-gray-300 shadow-sm p-8 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Nog geen projectbeoordelingen
            </h2>
            <p className="text-gray-600 mb-6">
              Zodra je eerste project is beoordeeld, zie je hier jouw cijfers en
              ontwikkeling.
            </p>
            <Link
              href="/student"
              className="inline-block rounded-lg bg-purple-600 text-white px-4 py-2 hover:bg-purple-700 transition-colors"
            >
              Ga terug naar dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Format category scores for display
  const categoryScoresText = Object.entries(stats.categoryAverages)
    .map(([key, value]) => `${key} ${value.toFixed(1)}`)
    .join(" • ");

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            Projectoverzicht
          </h1>
          <p className="text-gray-600">
            Overzicht van jouw projectbeoordelingen, cijfers en ontwikkeling.
          </p>
        </div>

        {/* KPI Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KPITile
            icon="📊"
            title="Gemiddeld projectcijfer"
            value={stats.avgGrade.toFixed(1)}
          />
          <KPITile
            icon="✅"
            title="Aantal afgeronde projecten"
            value={stats.completedCount}
          />
        </div>

        <div className="rounded-xl bg-white border border-gray-300 shadow-sm p-4">
          <div className="text-sm text-gray-500 mb-1">
            Gemiddelde score per categorie
          </div>
          <div className="text-base text-gray-700">{categoryScoresText}</div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart */}
          <div className="rounded-xl bg-white border border-gray-300 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Cijfers per project
            </h3>
            <div className="h-64">
              <ProjectLineChart data={stats.gradesTrend} />
            </div>
          </div>

          {/* Radar Chart */}
          <div className="rounded-xl bg-white border border-gray-300 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Sterktes en ontwikkelpunten
            </h3>
            <div className="flex items-center justify-center h-64">
              <ProjectRadarChart categoryAverages={stats.categoryAverages} />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl bg-white border border-gray-300 shadow-sm overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Alle projectbeoordelingen
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-y border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Datum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Docent
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projectAssessments.map((assessment) => (
                  <tr key={assessment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {assessment.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {assessment.group_name || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {assessment.published_at
                        ? new Date(assessment.published_at).toLocaleDateString(
                            "nl-NL"
                          )
                        : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {assessment.teacher_name || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <Link
                        href={`/student/project-assessments/${assessment.id}`}
                        className="text-purple-600 hover:text-purple-800 font-medium"
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Back to Dashboard */}
        <div className="text-center">
          <Link
            href="/student"
            className="inline-block text-purple-600 hover:text-purple-800 font-medium"
          >
            ← Terug naar dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
