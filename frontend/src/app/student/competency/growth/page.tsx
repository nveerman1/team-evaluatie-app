"use client";

import { useState, useEffect } from "react";
import { useStudentGrowth } from "@/hooks";
import {
  CompetencyRadarChart,
  CATEGORY_COLORS,
} from "@/components/student/competency/CompetencyRadarChart";
import type {
  GrowthGoal,
  GrowthReflection,
  GrowthCategoryScore,
  GrowthCompetencyScore,
  StudentGrowthData,
  ScanListItem,
  RadarCategoryScore,
} from "@/dtos";
import Link from "next/link";
import { studentStyles } from "@/styles/student-dashboard.styles";
import { studentService } from "@/services";

// Helper function to get score badge styling
function getScoreBadgeClass(score: number | null): string {
  if (score === null) return "";
  if (score >= 4) return "bg-emerald-50 text-emerald-700";
  if (score >= 3) return "bg-blue-50 text-blue-700";
  return "bg-amber-50 text-amber-700";
}

// Loading skeleton for cards
function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-white rounded-2xl border border-slate-200 shadow-sm p-5 ${className}`}
    >
      <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
      <div className="space-y-2">
        <div className="h-3 bg-slate-200 rounded w-full" />
        <div className="h-3 bg-slate-200 rounded w-2/3" />
      </div>
    </div>
  );
}

export default function GrowthPage() {
  const { data, isLoading, error, regenerateSummary, isRegenerating } =
    useStudentGrowth();

  // Show empty state if no data
  if (!isLoading && !data) {
    return (
      <div className={studentStyles.layout.pageContainer}>
        <div className={studentStyles.header.container}>
          <header className={studentStyles.header.wrapper}>
            <h1 className={studentStyles.header.title}>
              Mijn Groei
            </h1>
            <p className={studentStyles.header.subtitle}>
              Bekijk hoe jouw competenties, leerdoelen en reflecties zich
              ontwikkelen over meerdere scans.
            </p>
          </header>
        </div>
        <main className={studentStyles.layout.contentWrapper}>
          <div className="p-8 border border-slate-200 rounded-2xl bg-slate-50 text-center">
            <p className="text-slate-500">
              {error ? `Fout: ${error}` : "Nog geen groei-data beschikbaar. Maak eerst een competentiescan."}
            </p>
            <Link
              href="/student"
              className={studentStyles.buttons.primary + " mt-4 inline-block px-4 py-2 text-white"}
            >
              Terug naar Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={studentStyles.layout.pageContainer}>
      {/* Header */}
      <div className={studentStyles.header.container}>
        <header className={studentStyles.header.wrapper}>
          <div className={studentStyles.header.flexContainer}>
            <div className={studentStyles.header.titleSection}>
              <h1 className={studentStyles.header.title}>
                Mijn Groei
              </h1>
              <p className={studentStyles.header.subtitle}>
                Bekijk hoe jouw competenties, leerdoelen en reflecties zich
                ontwikkelen over meerdere scans.
              </p>
            </div>
            <div className="flex gap-2 sm:self-start">
              <Link
                href="/student?tab=competenties"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors bg-white"
              >
                <span className="mr-2">←</span>
                Terug
              </Link>
              <button
                className={studentStyles.buttons.primary + " px-4 py-2 text-sm font-semibold text-white shadow-sm"}
                onClick={() => {
                  // TODO: Implement portfolio export functionality
                  alert("Exportfunctie komt binnenkort beschikbaar.");
                }}
              >
                Exporteer voor portfolio
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Content */}
      <div className={studentStyles.layout.contentWrapper + " space-y-6"}>
        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-6">
            <CardSkeleton className="h-80" />
            <div className="grid gap-6 lg:grid-cols-3">
              <CardSkeleton className="lg:col-span-2 h-72" />
              <CardSkeleton className="h-72" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <CardSkeleton className="h-64" />
              <CardSkeleton className="h-64" />
            </div>
            <CardSkeleton className="h-40" />
          </div>
        )}

        {/* Main content when data is loaded */}
        {!isLoading && data && (
          <>
            {/* 1. Competentieprofiel (radardiagram) with scan selector */}
            <CompetencyProfileSection profile={data.competency_profile} scans={data.scans} />

            {/* 2. Scores per competentie (table with scan selector) */}
            <CompetencyScoresSection scores={data.competency_scores} scans={data.scans} />

            {/* 3. Leerdoelen tabel (updated to table format) */}
            <GoalsTableSection goals={data.goals} />

            {/* 4. Reflections */}
            <ReflectionsSection reflections={data.reflections} />
          </>
        )}
      </div>
    </div>
  );
}

// ============ Section Components ============

function CompetencyProfileSection({
  profile,
  scans,
}: {
  profile: GrowthCategoryScore[];
  scans: { id: string; title: string; date: string }[];
}) {
  const [selectedScanId, setSelectedScanId] = useState<string>("");
  const [scanRadarData, setScanRadarData] = useState<RadarCategoryScore[] | null>(null);
  const [loadingScan, setLoadingScan] = useState(false);

  useEffect(() => {
    const fetchScanData = async () => {
      if (!selectedScanId) {
        setScanRadarData(null);
        return;
      }
      try {
        setLoadingScan(true);
        const data = await studentService.getScanRadarData(selectedScanId);
        setScanRadarData(data.categories);
      } catch (err) {
        console.error("Failed to load scan data:", err);
        setScanRadarData(null);
      } finally {
        setLoadingScan(false);
      }
    };
    fetchScanData();
  }, [selectedScanId]);

  // Use scan data if selected, otherwise use overall profile
  const displayProfile = selectedScanId && scanRadarData
    ? scanRadarData.map(cat => ({ name: cat.category_name, value: cat.average_score }))
    : profile;

  if (!profile || profile.length === 0) {
    return (
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className={studentStyles.typography.sectionTitle}>
          Competentieprofiel
        </h2>
        <p className={studentStyles.typography.infoText + " mt-2"}>
          Nog geen competentiedata beschikbaar.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className={studentStyles.typography.sectionTitle}>
            Competentieprofiel
          </h2>
          <p className={studentStyles.typography.infoTextSmall + " mt-1"}>
            Jouw gemiddelde niveau per competentiecategorie{selectedScanId ? " voor de geselecteerde scan" : ", op basis van meerdere scans"}.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Radardiagram
        </span>
      </div>

      {/* Scan selector dropdown */}
      {scans && scans.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">
            Selecteer scan:
          </label>
          <select
            value={selectedScanId}
            onChange={(e) => setSelectedScanId(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm flex-1 max-w-md"
          >
            <option value="">Alle scans (gemiddeld)</option>
            {scans.map((scan) => (
              <option key={scan.id} value={scan.id}>
                {scan.title} ({scan.date})
              </option>
            ))}
          </select>
        </div>
      )}

      {loadingScan ? (
        <div className="text-center py-8 text-sm text-slate-500">
          Scan data laden...
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3 items-start">
          {/* Radar chart */}
          <div className="md:col-span-2 flex items-center justify-center">
            <CompetencyRadarChart
              items={displayProfile.map((cat) => ({
                name: cat.name,
                value: cat.value,
              }))}
              size={256}
              maxValue={5}
            />
          </div>

          {/* Legend + explanation */}
          <div className="space-y-2 text-xs text-slate-600">
            <p className="font-medium text-slate-800 mb-1">
              Competentiecategorieën
            </p>
            <ul className="space-y-1">
              {displayProfile.map((cat, index) => (
                <li
                  key={cat.name}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                      }}
                    />
                    <span>{cat.name}</span>
                  </div>
                  <span className="text-slate-700 font-medium">
                    {cat.value.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

// Competency scores table with scan filter
function CompetencyScoresSection({ 
  scores,
  scans,
}: { 
  scores: GrowthCompetencyScore[];
  scans: { id: string; title: string; date: string }[];
}) {
  const [selectedScanId, setSelectedScanId] = useState<string>("");
  const [scanScores, setScanScores] = useState<GrowthCompetencyScore[] | null>(null);
  const [loadingScores, setLoadingScores] = useState(false);

  useEffect(() => {
    const fetchScanScores = async () => {
      if (!selectedScanId) {
        setScanScores(null);
        return;
      }
      try {
        setLoadingScores(true);
        const data = await studentService.getScanCompetencyScores(selectedScanId);
        setScanScores(data);
      } catch (err) {
        console.error("Failed to load scan scores:", err);
        setScanScores([]);
      } finally {
        setLoadingScores(false);
      }
    };
    fetchScanScores();
  }, [selectedScanId]);

  if (!scores || scores.length === 0) {
    return (
      <section className={studentStyles.cards.infoCard.container}>
        <div className={studentStyles.cards.infoCard.content}>
          <h2 className={studentStyles.typography.sectionTitle}>
            Scores per competentie
          </h2>
          <p className={studentStyles.typography.infoText}>
            Nog geen competentiescores beschikbaar.
          </p>
        </div>
      </section>
    );
  }

  // Use scan-specific scores if available, otherwise use overall scores
  const displayScores = selectedScanId && scanScores !== null ? scanScores : scores;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
        <h2 className={studentStyles.typography.sectionTitle}>
          Scores per competentie
        </h2>
        <p className={studentStyles.typography.infoTextSmall + " mt-1"}>
          {selectedScanId ? "Scores voor de geselecteerde scan" : "De meest recente score per competentie over alle scans"}
        </p>
      </div>
      
      {/* Scan filter dropdown */}
      {scans && scans.length > 0 && (
        <div className="px-5 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">
              Filter op scan:
            </label>
            <select
              value={selectedScanId}
              onChange={(e) => setSelectedScanId(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm flex-1 max-w-md"
            >
              <option value="">Alle scans (meest recent)</option>
              {scans.map((scan) => (
                <option key={scan.id} value={scan.id}>
                  {scan.title} ({scan.date})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loadingScores ? (
        <div className="px-5 py-8 text-center text-sm text-slate-500">
          Scores laden...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold tracking-wide text-slate-600">
                <th className="px-5 py-3">Categorie</th>
                <th className="px-5 py-3">Competentie</th>
                <th className="px-4 py-3 text-center">Score</th>
                <th className="px-4 py-3">Scan</th>
                <th className="px-4 py-3">Datum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayScores.length > 0 ? (
                displayScores.map((score) => (
                  <tr key={`${score.competency_id}-${score.window_id}`} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-600">
                      {score.category_name || "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-800 font-medium">
                      {score.competency_name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {score.most_recent_score !== null ? (
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-md text-sm font-medium ${getScoreBadgeClass(score.most_recent_score)}`}
                        >
                          {score.most_recent_score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {score.window_title || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {score.scan_date || "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    Geen scores gevonden voor deze scan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Updated goals section as a table
function GoalsTableSection({ goals }: { goals: GrowthGoal[] }) {
  if (!goals || goals.length === 0) {
    return (
      <section className={studentStyles.cards.infoCard.container}>
        <div className={studentStyles.cards.infoCard.content}>
          <h2 className={studentStyles.typography.sectionTitle}>Leerdoelen</h2>
          <p className={studentStyles.typography.infoText}>
            Je hebt nog geen leerdoelen ingesteld.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
        <div>
          <h2 className={studentStyles.typography.sectionTitle}>Leerdoelen</h2>
          <p className={studentStyles.typography.infoTextSmall + " mt-1"}>
            Al je leerdoelen over alle scans
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold tracking-wide text-slate-600">
              <th className="px-5 py-3">Leerdoel</th>
              <th className="px-5 py-3">Gerelateerde competenties</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {goals.map((goal) => (
              <tr key={goal.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-800 font-medium">
                  {goal.title}
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {goal.related_competencies.map((c) => (
                      <span
                        key={c}
                        className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      goal.status === "active"
                        ? studentStyles.badges.activeGoal
                        : studentStyles.badges.completedGoal
                    }`}
                  >
                    {goal.status === "active" ? "Actief" : "Behaald"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReflectionsSection({
  reflections,
}: {
  reflections: GrowthReflection[];
}) {
  const [expandedReflectionId, setExpandedReflectionId] = useState<string | null>(null);

  if (!reflections || reflections.length === 0) {
    return (
      <section className={studentStyles.cards.infoCard.container}>
        <div className={studentStyles.cards.infoCard.content}>
          <h2 className={studentStyles.typography.sectionTitle}>
            Reflecties over mijn groei
          </h2>
          <p className={studentStyles.typography.infoText}>
            Je hebt nog geen reflecties geschreven. Schrijf na een scan kort op
            wat goed ging en wat je volgende stap is.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h2 className={studentStyles.typography.sectionTitle + " mb-4"}>
        Reflecties over mijn groei
      </h2>
      <div className="space-y-4">
        {reflections.map((ref, idx) => {
          const isExpanded = expandedReflectionId === ref.id;
          return (
            <div key={ref.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1" />
                {idx < reflections.length - 1 && (
                  <div className="w-px flex-1 bg-slate-200 mt-1" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs text-slate-500">{ref.date}</p>
                <p className="text-sm font-medium text-slate-900">
                  {ref.scan_title}
                </p>
                <p className="text-xs text-slate-600 whitespace-pre-wrap">
                  {isExpanded ? ref.full_text : ref.snippet}
                </p>
                <button
                  className="mt-1 text-xs font-medium text-indigo-600 hover:underline"
                  onClick={() => {
                    setExpandedReflectionId(isExpanded ? null : ref.id);
                  }}
                >
                  {isExpanded ? "Verberg reflectie" : "Open volledige reflectie"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
