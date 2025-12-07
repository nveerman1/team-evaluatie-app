"use client";

import { useMemo } from "react";
import { useStudentProjectAssessments } from "@/hooks/useStudentProjectAssessments";
import { useStudentProjectDetails } from "@/hooks/useStudentProjectDetails";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";
import { ProjectLineChart } from "./components/ProjectLineChart";
import { ProjectRadarChart } from "./components/ProjectRadarChart";
import type { ProjectAssessmentListItem } from "@/dtos/project-assessment.dto";

// Page Header component matching other student pages
const PageHeader = () => {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Projectoverzicht
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Overzicht van jouw projectbeoordelingen, cijfers en ontwikkeling.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/student#projecten"
            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="mr-2">←</span>
            Terug
          </Link>
        </div>
      </div>
    </header>
  );
};

export default function ProjectOverviewPage() {
  const {
    assessments: projectAssessments,
    loading,
    error,
  } = useStudentProjectAssessments();

  // Fetch detailed assessment data for all projects
  const assessmentIds = useMemo(() => {
    return projectAssessments?.map(a => a.id) || [];
  }, [projectAssessments]);

  const {
    details: projectDetails,
    loading: detailsLoading,
    error: detailsError,
  } = useStudentProjectDetails(assessmentIds);

  // Compute statistics from project assessments
  const stats = useMemo(() => {
    if (!projectAssessments || projectAssessments.length === 0) {
      return {
        avgGrade: 0,
        completedCount: 0,
        categoryAverages: {},
        gradesTrend: [],
        topCategories: [],
      };
    }

    const completedCount = projectAssessments.length;
    
    // Calculate real average grade from detailed assessments
    let totalGrade = 0;
    let gradeCount = 0;
    projectDetails.forEach((detail) => {
      if (detail.grade !== null && detail.grade !== undefined) {
        totalGrade += detail.grade;
        gradeCount++;
      }
    });
    const avgGrade = gradeCount > 0 ? totalGrade / gradeCount : 0;
    
    // Calculate category averages from criterion scores
    const categorySums: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    
    projectDetails.forEach((detail) => {
      // Group scores by category
      detail.criteria.forEach((criterion) => {
        if (criterion.category) {
          const score = detail.scores.find(s => s.criterion_id === criterion.id);
          if (score) {
            if (!categorySums[criterion.category]) {
              categorySums[criterion.category] = 0;
              categoryCounts[criterion.category] = 0;
            }
            categorySums[criterion.category] += score.score;
            categoryCounts[criterion.category]++;
          }
        }
      });
    });
    
    const categoryAverages: Record<string, number> = {};
    Object.keys(categorySums).forEach((category) => {
      categoryAverages[category] = categorySums[category] / categoryCounts[category];
    });

    // Get top 2 categories for KPI tile
    const topCategories = Object.entries(categoryAverages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2);

    // Prepare trend data for line chart with real grades
    const gradesTrend = projectAssessments.map((assessment) => {
      const detail = projectDetails.get(assessment.id);
      return {
        label: assessment.title.substring(0, 20),
        grade: detail?.grade || 0,
        date: assessment.published_at || "",
      };
    });

    return {
      avgGrade,
      completedCount,
      categoryAverages,
      gradesTrend,
      topCategories,
    };
  }, [projectAssessments, projectDetails]);

  if (loading || detailsLoading) {
    return (
      <main className="min-h-screen bg-slate-100/80">
        <PageHeader />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Loading />
        </div>
      </main>
    );
  }

  if (error || detailsError) {
    return (
      <main className="min-h-screen bg-slate-100/80">
        <PageHeader />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <ErrorMessage message={error || detailsError || "An error occurred"} />
        </div>
      </main>
    );
  }

  // Empty state
  if (!projectAssessments || projectAssessments.length === 0) {
    return (
      <main className="min-h-screen bg-slate-100/80">
        <PageHeader />
        <div className="mx-auto max-w-6xl px-4 py-8">
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
              href="/student#projecten"
              className="inline-block rounded-lg bg-slate-900 text-white px-4 py-2 hover:bg-slate-800 transition-colors"
            >
              Ga terug naar dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100/80 text-slate-900">
      <PageHeader />
      
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-8">
        {/* Tip banner */}
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 p-3 shadow-sm ring-1 ring-slate-200/80">
          <div className="flex flex-col text-xs text-slate-600 sm:flex-row sm:items-center sm:gap-2">
            <span className="font-medium text-slate-800">Tip</span>
            <span>
              Gebruik deze pagina om je ontwikkeling over meerdere projecten te volgen.
            </span>
          </div>
          <Link
            href="/student#projecten"
            className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Terug naar dashboard
          </Link>
        </div>

        {/* KPI tiles */}
        <section className="grid gap-4 md:grid-cols-4">
          <div className="group flex flex-col justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Gemiddeld projectcijfer
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Nieuw
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-slate-900">{stats.avgGrade.toFixed(1)}</span>
              <span className="text-xs text-slate-500">/ 10</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Gebaseerd op al je afgeronde projectbeoordelingen.
            </p>
          </div>

          <div className="group flex flex-col justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Afgeronde projecten
            </span>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-semibold text-slate-900">{stats.completedCount}</span>
              <span className="text-[11px] text-slate-500">totaal</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {stats.completedCount === 1 ? 'project' : 'projecten'} in totaal beoordeeld.
            </p>
          </div>

          <div className="group flex flex-col justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Sterkste categorieën
            </span>
            <div className="mt-3 space-y-1 text-[11px] text-slate-600">
              {stats.topCategories.length > 0 ? (
                <>
                  {stats.topCategories.map(([category, score], index) => (
                    <p key={category}>
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          index === 0 ? 'bg-sky-500' : 'bg-violet-500'
                        }`}
                        aria-hidden="true"
                      ></span>{' '}
                      {category} • {score.toFixed(1)}/5
                    </p>
                  ))}
                </>
              ) : (
                <p>Nog geen scores beschikbaar</p>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Gebaseerd op rubric-scores.
            </p>
          </div>

          <div className="group flex flex-col justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Focus voor volgende project
            </span>
            <p className="mt-3 text-[11px] text-slate-600">
              Bekijk je feedback per project om specifieke tips te vinden voor jouw ontwikkeling.
            </p>
            <span className="mt-3 inline-flex w-fit items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white">
              Zie projecten
            </span>
          </div>
        </section>

        {/* Charts */}
        <section className="grid gap-4 lg:grid-cols-5">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Cijfers per project</h2>
              <span className="text-[11px] text-slate-500">Lijngrafiek</span>
            </div>
            <div className="mt-3 h-56">
              <ProjectLineChart data={stats.gradesTrend} />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Sterktes en ontwikkelpunten
              </h2>
              <span className="text-[11px] text-slate-500">Radar grafiek</span>
            </div>
            <div className="mt-3 flex h-56 items-center justify-center">
              <ProjectRadarChart categoryAverages={stats.categoryAverages} />
            </div>
          </div>
        </section>

        {/* AI summary */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Samenvatting van jouw projectontwikkeling
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  AI maakt op basis van meerdere projectbeoordelingen een kort
                  overzicht van je sterktes en groeikansen.
                </p>
              </div>
              <button className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-slate-800">
                Vernieuw samenvatting
              </button>
            </div>
            <div className="mt-3 grid gap-3 text-xs text-slate-600 md:grid-cols-3">
              <div className="rounded-xl bg-emerald-50/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Sterke punten
                </p>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  <li>Consistente kwaliteit in eindproducten.</li>
                  <li>Duidelijke presentaties voor opdrachtgever.</li>
                </ul>
              </div>
              <div className="rounded-xl bg-amber-50/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                  Ontwikkelpunten
                </p>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  <li>Planning en taakverdeling concreter maken.</li>
                  <li>Reflecties uitbreiden met voorbeelden.</li>
                </ul>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                  Volgende stap
                </p>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  <li>Kies 1 categorie om bewust op te focussen.</li>
                  <li>Bespreek je doelen met je docent of coach.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Mini legend */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Legenda rubriccategorieën
            </h2>
            <ul className="mt-3 space-y-2 text-xs text-slate-600">
              {Object.keys(stats.categoryAverages).map((category, index) => {
                const colors = ['bg-sky-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500'];
                return (
                  <li key={category} className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${colors[index % colors.length]}`}
                      aria-hidden="true"
                    ></span>
                    {category}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">
              De kleuren sluiten aan bij de grafieken op deze pagina en bij
              de projectrubric.
            </p>
          </div>
        </section>

        {/* Table */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Alle projectbeoordelingen
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Vergelijk je projecten en open details per beoordeling.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
                <option>Sorteren op nieuwste</option>
                <option>Sorteren op oudste</option>
                <option>Sorteren op titel</option>
              </select>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Project</th>
                  <th className="px-3 py-2 font-medium">Periode</th>
                  <th className="px-3 py-2 font-medium">Docent</th>
                  <th className="px-3 py-2 font-medium">Projectproces</th>
                  <th className="px-3 py-2 font-medium">Eindresultaat</th>
                  <th className="px-3 py-2 font-medium">Communicatie</th>
                  <th className="px-3 py-2 font-medium text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projectAssessments.map((assessment) => {
                  const detail = projectDetails.get(assessment.id);
                  
                  // Calculate category scores for this assessment
                  const categoryScores: Record<string, { sum: number; count: number; max: number }> = {};
                  
                  if (detail) {
                    detail.criteria.forEach((criterion) => {
                      if (criterion.category) {
                        const score = detail.scores.find(s => s.criterion_id === criterion.id);
                        if (score) {
                          if (!categoryScores[criterion.category]) {
                            categoryScores[criterion.category] = { sum: 0, count: 0, max: detail.rubric_scale_max };
                          }
                          categoryScores[criterion.category].sum += score.score;
                          categoryScores[criterion.category].count++;
                        }
                      }
                    });
                  }
                  
                  const getAvgScore = (category: string) => {
                    const data = categoryScores[category];
                    if (!data || data.count === 0) return null;
                    return (data.sum / data.count).toFixed(1);
                  };
                  
                  return (
                    <tr key={assessment.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-slate-900">
                            {assessment.title}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {assessment.course_name || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-slate-600">
                        {assessment.published_at
                          ? new Date(assessment.published_at).toLocaleDateString('nl-NL', {
                              year: 'numeric',
                              month: 'long',
                            })
                          : '—'}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-slate-600">
                        {assessment.teacher_name || '—'}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-slate-600">
                        {getAvgScore('Projectproces') !== null 
                          ? `${getAvgScore('Projectproces')}/5` 
                          : '—'}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-slate-600">
                        {getAvgScore('Eindresultaat') !== null 
                          ? `${getAvgScore('Eindresultaat')}/5` 
                          : '—'}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-slate-600">
                        {getAvgScore('Communicatie') !== null 
                          ? `${getAvgScore('Communicatie')}/5` 
                          : '—'}
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <Link
                          href={`/student/project-assessments/${assessment.id}`}
                          className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-slate-800"
                        >
                          Bekijk details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
