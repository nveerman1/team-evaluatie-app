"use client";

import { useState } from "react";
import { useStudentGrowth } from "@/hooks";
import {
  CompetencyRadarChart,
  CATEGORY_COLORS,
} from "@/components/student/competency/CompetencyRadarChart";
import type {
  GrowthGoal,
  GrowthReflection,
  GrowthCategoryScore,
  StudentGrowthData,
  GrowthScanSummary,
  GrowthCompetencyScore,
  GrowthGoalDetailed,
} from "@/dtos";
import Link from "next/link";
import { studentStyles } from "@/styles/student-dashboard.styles";

// Development mock data - used when API is unavailable
const DEV_MOCK_DATA: StudentGrowthData = {
  scans: [
    {
      id: "1",
      title: "Startscan Q1 2025",
      date: "30-09-2025",
      type: "start",
      omza: { organiseren: 2.8, meedoen: 3.2, zelfvertrouwen: 2.5, autonomie: 2.7 },
      gcf: 3.0,
      has_reflection: true,
      goals_linked: 1,
    },
    {
      id: "2",
      title: "Test externen",
      date: "09-11-2025",
      type: "los",
      omza: { organiseren: 3.1, meedoen: 3.6, zelfvertrouwen: 3.2, autonomie: 3.0 },
      gcf: 3.5,
      has_reflection: true,
      goals_linked: 2,
    },
    {
      id: "3",
      title: "Tussenscan Q2 2025",
      date: "15-01-2026",
      type: "tussen",
      omza: { organiseren: 3.4, meedoen: 3.8, zelfvertrouwen: 3.5, autonomie: 3.3 },
      gcf: 3.8,
      has_reflection: false,
      goals_linked: 2,
    },
  ],
  competency_profile: [
    { name: "Samenwerken", value: 3.7 },
    { name: "Plannen & Organiseren", value: 3.1 },
    { name: "Creatief denken & probleemoplossen", value: 3.9 },
    { name: "Technische vaardigheden", value: 3.5 },
    { name: "Communicatie & Presenteren", value: 3.3 },
    { name: "Reflectie & Professionele houding", value: 3.2 },
  ],
  goals: [
    {
      id: "g1",
      title: "Ik plan mijn werk in kleine stappen",
      status: "active",
      related_competencies: ["Plannen & Organiseren", "Reflectie & Professionele houding"],
      progress: 65,
    },
    {
      id: "g2",
      title: "Ik durf vaker mijn idee te delen in het team",
      status: "active",
      related_competencies: ["Samenwerken", "Communicatie & Presenteren"],
      progress: 40,
    },
    {
      id: "g3",
      title: "Ik vraag gericht feedback op mijn tussenproducten",
      status: "completed",
      related_competencies: ["Samenwerken", "Reflectie & Professionele houding"],
      progress: 100,
    },
  ],
  reflections: [
    {
      id: "r1",
      date: "09-11-2025",
      scan_title: "Test externen",
      snippet:
        "Ik merk dat samenwerken met externen mij helpt om duidelijker te communiceren en beter te plannen...",
    },
    {
      id: "r2",
      date: "30-09-2025",
      scan_title: "Startscan Q1 2025",
      snippet:
        "Bij de startscan zie ik dat plannen en organiseren nog een ontwikkelpunt is. Ik wil tijdens dit project beter bijhouden wat ik af heb...",
    },
  ],
  ai_summary:
    "Je laat de meeste groei zien in Samenwerken en Creatief denken: je neemt vaker initiatief in je team en onderzoekt meerdere oplossingen. Plannen & Organiseren blijft nog een aandachtspunt; je geeft zelf aan dat je planning niet altijd haalbaar is. Een passend leerdoel is: \"Ik plan mijn werk in kleinere stappen en controleer aan het einde van het blok wat af is.\" Probeer in je volgende reflectie concreet op te schrijven wat je anders hebt aangepakt.",
};

// Helper function to find the strongest and weakest OMZA domains
function analyzeOMZA(omza: { organiseren: number; meedoen: number; zelfvertrouwen: number; autonomie: number }) {
  const entries = Object.entries(omza) as [keyof typeof omza, number][];
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const labels: Record<keyof typeof omza, string> = {
    organiseren: "Organiseren",
    meedoen: "Meedoen",
    zelfvertrouwen: "Zelfvertrouwen",
    autonomie: "Autonomie",
  };
  return {
    strongest: {
      key: sorted[0][0],
      label: labels[sorted[0][0]],
      value: sorted[0][1],
    },
    weakest: {
      key: sorted[sorted.length - 1][0],
      label: labels[sorted[sorted.length - 1][0]],
      value: sorted[sorted.length - 1][1],
    },
  };
}

// Loading skeleton for cards
function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 ${className}`}
    >
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
      </div>
    </div>
  );
}

export default function GrowthPage() {
  const { data: apiData, isLoading, error, regenerateSummary, isRegenerating } =
    useStudentGrowth();

  // Use mock data when API fails (for development/preview)
  const data = apiData || (error ? DEV_MOCK_DATA : null);

  // Count goals by status (for future use, e.g., KPI display)
  const _activeGoals = data?.goals?.filter((g) => g.status === "active").length ?? 0;
  const _completedGoals = data?.goals?.filter((g) => g.status === "completed").length ?? 0;

  // Show empty state if no data
  if (!isLoading && !error && !data) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
          <header className="px-6 py-6 max-w-6xl mx-auto">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Mijn Groei
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Bekijk hoe jouw competenties, leerdoelen en reflecties zich
              ontwikkelen over meerdere scans.
            </p>
          </header>
        </div>
        <main className="max-w-6xl mx-auto px-6 py-6">
          <div className="p-8 border rounded-xl bg-gray-50 text-center">
            <p className="text-gray-500">
              Nog geen groei-data beschikbaar. Maak eerst een competentiescan.
            </p>
            <Link
              href="/student"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
        <div className={studentStyles.header.wrapper}>
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
            <div className="flex items-center gap-2">
              <Link
                href="/student?tab=competenties"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
              >
                <span className="mr-2">←</span>
                Terug
              </Link>
              <button
                className="inline-flex items-center justify-center rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-white/25 transition-colors"
                onClick={() => {
                  // TODO: Implement portfolio export functionality
                  alert("Exportfunctie komt binnenkort beschikbaar.");
                }}
              >
                Exporteer voor portfolio
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={studentStyles.layout.contentWrapper}>
        <div className="space-y-4">
          {/* Dev mode indicator when using mock data */}
          {error && !apiData && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700">
              ⚠️ Voorbeeldmodus: Backend niet beschikbaar, mockdata wordt getoond.
            </div>
          )}

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
            {/* 1. Competentieprofiel (radardiagram) with scan comparison */}
            <CompetencyProfileSection 
              profile={data.competency_profile} 
              scans={data.scans}
            />

            {/* 2. Competency Scores Table */}
            {data.competency_scores && data.competency_scores.length > 0 && (
              <CompetencyScoresSection scores={data.competency_scores} />
            )}

            {/* 3. Learning Goals Table */}
            {data.goals_detailed && data.goals_detailed.length > 0 && (
              <LearningGoalsSection goals={data.goals_detailed} />
            )}

            {/* 4. Reflections */}
            <ReflectionsSection reflections={data.reflections} />

            {/* 5. AI Summary */}
            <AISummarySection
              summary={data.ai_summary}
              onRegenerate={regenerateSummary}
              isRegenerating={isRegenerating}
            />
          </>
        )}
        </div>
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
  scans: GrowthScanSummary[];
}) {
  const [selectedScan, setSelectedScan] = useState<string | null>(null);

  if (!profile || profile.length === 0) {
    return (
      <section className={studentStyles.cards.listCard.container}>
        <div className={studentStyles.cards.listCard.content}>
          <h2 className={studentStyles.typography.cardTitle}>
            Competentieprofiel
          </h2>
          <p className={studentStyles.typography.infoText}>
            Nog geen competentiedata beschikbaar.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={studentStyles.cards.listCard.container}>
      <div className={studentStyles.cards.listCard.content}>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className={studentStyles.typography.cardTitle}>
                Competentieprofiel
              </h2>
              <p className={studentStyles.typography.infoTextSmall}>
                Jouw gemiddelde niveau per competentiecategorie, op basis van
                meerdere scans.
              </p>
            </div>
            {scans && scans.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600">Vergelijk met:</label>
                <select
                  value={selectedScan || ""}
                  onChange={(e) => setSelectedScan(e.target.value || null)}
                  className="rounded-xl border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="">Huidige gemiddelde</option>
                  {scans.map((scan) => (
                    <option key={scan.id} value={scan.id}>
                      {scan.title} ({scan.date})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-3 items-start">
            {/* Radar chart */}
            <div className="md:col-span-2 flex items-center justify-center">
              <CompetencyRadarChart
                items={profile.map((cat) => ({
                  name: cat.name,
                  value: cat.value,
                }))}
                size={256}
                maxValue={5}
              />
            </div>

            {/* Legend + explanation */}
            <div className="space-y-2">
              <p className={studentStyles.typography.metaText}>
                Competentiecategorieën
              </p>
              <ul className="space-y-1.5">
                {profile.map((cat, index) => (
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
                      <span className={studentStyles.typography.infoTextSmall}>
                        {cat.name}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">
                      {cat.value.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CompetencyScoresSection({ scores }: { scores: GrowthCompetencyScore[] }) {
  return (
    <section className={studentStyles.cards.listCard.container}>
      <div className={studentStyles.cards.listCard.content}>
        <div className="space-y-4">
          <div>
            <h2 className={studentStyles.typography.cardTitle}>
              Scores per competentie
            </h2>
            <p className={studentStyles.typography.infoTextSmall}>
              Meest recente scores voor elke competentie
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                    Categorie
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                    Competentie
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
                    Self
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
                    Extern
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
                    Gemiddelde
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                    Scan
                  </th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score, idx) => (
                  <tr
                    key={score.competency_id}
                    className={idx < scores.length - 1 ? "border-b border-slate-100" : ""}
                  >
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {score.category_name || "—"}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-800 font-medium">
                      {score.competency_name}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {score.most_recent_self_score !== null ? (
                        <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                          {score.most_recent_self_score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {score.most_recent_external_score !== null ? (
                        <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700">
                          {score.most_recent_external_score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {score.most_recent_final_score !== null ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                            score.most_recent_final_score >= 4
                              ? "bg-emerald-50 text-emerald-700"
                              : score.most_recent_final_score >= 3
                              ? "bg-blue-50 text-blue-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {score.most_recent_final_score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {score.window_title ? (
                        <div>
                          <div className="font-medium truncate max-w-[150px]" title={score.window_title}>
                            {score.window_title}
                          </div>
                          {score.window_date && (
                            <div className="text-slate-500">{score.window_date}</div>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function LearningGoalsSection({ goals }: { goals: GrowthGoalDetailed[] }) {
  return (
    <section className={studentStyles.cards.listCard.container}>
      <div className={studentStyles.cards.listCard.content}>
        <div className="space-y-4">
          <div>
            <h2 className={studentStyles.typography.cardTitle}>
              Leerdoelen (alle scans)
            </h2>
            <p className={studentStyles.typography.infoTextSmall}>
              Overzicht van al je leerdoelen over verschillende competentiescans
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                    Leerdoel
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                    Competentie
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                    Scan
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                    Datum
                  </th>
                </tr>
              </thead>
              <tbody>
                {goals.map((goal, idx) => (
                  <tr
                    key={goal.id}
                    className={idx < goals.length - 1 ? "border-b border-slate-100" : ""}
                  >
                    <td className="px-3 py-3 text-sm text-slate-800">
                      <div className="max-w-md" title={goal.title}>
                        {goal.title}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {goal.competency_name ? (
                        <div>
                          <div className="font-medium">{goal.competency_name}</div>
                          {goal.category_name && (
                            <div className="text-slate-500">{goal.category_name}</div>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          goal.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-amber-50 text-amber-700 border border-amber-100"
                        }`}
                      >
                        {goal.status === "completed" ? "Behaald" : "Actief"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      <div className="max-w-[150px] truncate" title={goal.window_title}>
                        {goal.window_title}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {goal.window_date || goal.submitted_at || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReflectionsSection({
  reflections,
}: {
  reflections: GrowthReflection[];
}) {
  return (
    <section className={studentStyles.cards.listCard.container}>
      <div className={studentStyles.cards.listCard.content}>
        <div className="space-y-4">
          <div>
            <h2 className={studentStyles.typography.cardTitle}>
              Reflecties over mijn groei
            </h2>
            <p className={studentStyles.typography.infoTextSmall}>
              Je reflecties uit verschillende competentiescans
            </p>
          </div>

          {!reflections || reflections.length === 0 ? (
            <p className={studentStyles.typography.infoText}>
              Je hebt nog geen reflecties geschreven. Schrijf na een scan kort op
              wat goed ging en wat je volgende stap is.
            </p>
          ) : (
            <div className="space-y-4">
              {reflections.map((ref, idx) => (
                <div key={ref.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1" />
                    {idx < reflections.length - 1 && (
                      <div className="w-px flex-1 bg-slate-200 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className={studentStyles.typography.metaTextSmall}>{ref.date}</p>
                    <p className={studentStyles.typography.metaText}>
                      {ref.scan_title}
                    </p>
                    <p className={studentStyles.typography.infoText + " line-clamp-2"}>
                      {ref.snippet}
                    </p>
                    <button
                      className="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      onClick={() => {
                        // TODO: Implement full reflection view
                        alert("Volledige reflectie weergave komt binnenkort.");
                      }}
                    >
                      Lees meer →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AISummarySection({
  summary,
  onRegenerate,
  isRegenerating,
}: {
  summary: string | null;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  return (
    <section className={studentStyles.cards.listCard.container}>
      <div className={studentStyles.cards.listCard.content}>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className={studentStyles.typography.cardTitle}>
                AI-samenvatting van jouw groei
              </h2>
              <p className={studentStyles.typography.infoTextSmall}>
                Op basis van jouw scans, leerdoelen en reflecties.
              </p>
            </div>
            <button
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? "Genereren..." : "Samenvatting opnieuw genereren"}
            </button>
          </div>

          {isRegenerating ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-6 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
              <span className="ml-3 text-sm text-slate-600">
                Samenvatting wordt gegenereerd...
              </span>
            </div>
          ) : summary ? (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
              <p className={studentStyles.typography.infoText + " text-indigo-900"}>
                {summary}
              </p>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-center">
              <p className={studentStyles.typography.infoText}>
                Er is nog geen AI-samenvatting beschikbaar. Klik op de knop om er
                een te genereren.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
