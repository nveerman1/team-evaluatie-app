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
  GrowthCompetencyScore,
  StudentGrowthData,
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
  competency_scores: [
    { competency_id: 1, competency_name: "Effectief samenwerken in teams", category_name: "Samenwerken", most_recent_score: 3.8, window_id: 3, window_title: "Tussenscan Q2 2025", scan_date: "15-01-2026" },
    { competency_id: 2, competency_name: "Actief bijdragen aan groepsdiscussies", category_name: "Samenwerken", most_recent_score: 3.6, window_id: 3, window_title: "Tussenscan Q2 2025", scan_date: "15-01-2026" },
    { competency_id: 3, competency_name: "Taken plannen en organiseren", category_name: "Plannen & Organiseren", most_recent_score: 3.2, window_id: 3, window_title: "Tussenscan Q2 2025", scan_date: "15-01-2026" },
    { competency_id: 4, competency_name: "Tijdmanagement", category_name: "Plannen & Organiseren", most_recent_score: 3.0, window_id: 2, window_title: "Test externen", scan_date: "09-11-2025" },
    { competency_id: 5, competency_name: "Creatieve oplossingen bedenken", category_name: "Creatief denken & probleemoplossen", most_recent_score: 4.0, window_id: 3, window_title: "Tussenscan Q2 2025", scan_date: "15-01-2026" },
    { competency_id: 6, competency_name: "Problemen analyseren", category_name: "Creatief denken & probleemoplossen", most_recent_score: 3.8, window_id: 3, window_title: "Tussenscan Q2 2025", scan_date: "15-01-2026" },
    { competency_id: 7, competency_name: "Programmeren", category_name: "Technische vaardigheden", most_recent_score: 3.7, window_id: 3, window_title: "Tussenscan Q2 2025", scan_date: "15-01-2026" },
    { competency_id: 8, competency_name: "Technische documentatie", category_name: "Technische vaardigheden", most_recent_score: 3.3, window_id: 2, window_title: "Test externen", scan_date: "09-11-2025" },
    { competency_id: 9, competency_name: "Presenteren aan publiek", category_name: "Communicatie & Presenteren", most_recent_score: 3.4, window_id: 3, window_title: "Tussenscan Q2 2025", scan_date: "15-01-2026" },
    { competency_id: 10, competency_name: "Schriftelijke communicatie", category_name: "Communicatie & Presenteren", most_recent_score: 3.2, window_id: 2, window_title: "Test externen", scan_date: "09-11-2025" },
    { competency_id: 11, competency_name: "Reflecteren op eigen werk", category_name: "Reflectie & Professionele houding", most_recent_score: 3.3, window_id: 3, window_title: "Tussenscan Q2 2025", scan_date: "15-01-2026" },
    { competency_id: 12, competency_name: "Professioneel gedrag", category_name: "Reflectie & Professionele houding", most_recent_score: 3.1, window_id: 2, window_title: "Test externen", scan_date: "09-11-2025" },
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
  const { data: apiData, isLoading, error, regenerateSummary, isRegenerating } =
    useStudentGrowth();

  // Use mock data when API fails (for development/preview)
  const data = apiData || (error ? DEV_MOCK_DATA : null);

  // Show empty state if no data
  if (!isLoading && !error && !data) {
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
              Nog geen groei-data beschikbaar. Maak eerst een competentiescan.
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
            {/* 1. Competentieprofiel (radardiagram) */}
            <CompetencyProfileSection profile={data.competency_profile} />

            {/* 2. Scores per competentie (new table) */}
            <CompetencyScoresSection scores={data.competency_scores} />

            {/* 3. Leerdoelen tabel (updated to table format) */}
            <GoalsTableSection goals={data.goals} />

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
  );
}

// ============ Section Components ============

function CompetencyProfileSection({
  profile,
}: {
  profile: GrowthCategoryScore[];
function CompetencyProfileSection({
  profile,
}: {
  profile: GrowthCategoryScore[];
}) {
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
            Jouw gemiddelde niveau per competentiecategorie, op basis van
            meerdere scans.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Radardiagram
        </span>
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
        <div className="space-y-2 text-xs text-slate-600">
          <p className="font-medium text-slate-800 mb-1">
            Competentiecategorieën
          </p>
          <ul className="space-y-1">
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
    </section>
  );
}

// New section for competency scores table
function CompetencyScoresSection({ scores }: { scores: GrowthCompetencyScore[] }) {
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

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
        <h2 className={studentStyles.typography.sectionTitle}>
          Scores per competentie
        </h2>
        <p className={studentStyles.typography.infoTextSmall + " mt-1"}>
          De meest recente score per competentie over alle scans
        </p>
      </div>
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
            {scores.map((score) => (
              <tr key={score.competency_id} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-600">
                  {score.category_name || "—"}
                </td>
                <td className="px-5 py-3 text-slate-800 font-medium">
                  {score.competency_name}
                </td>
                <td className="px-4 py-3 text-center">
                  {score.most_recent_score !== null ? (
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-md text-sm font-medium ${
                        score.most_recent_score >= 4
                          ? "bg-emerald-50 text-emerald-700"
                          : score.most_recent_score >= 3
                          ? "bg-blue-50 text-blue-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
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
            ))}
          </tbody>
        </table>
      </div>
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
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <h2 className={studentStyles.typography.sectionTitle}>Leerdoelen</h2>
          <p className={studentStyles.typography.infoTextSmall + " mt-1"}>
            Al je leerdoelen over alle scans
          </p>
        </div>
        <button
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => {
            // TODO: Implement new goal creation
            alert("Nieuw leerdoel instellen komt binnenkort.");
          }}
        >
          Nieuw leerdoel
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold tracking-wide text-slate-600">
              <th className="px-5 py-3">Leerdoel</th>
              <th className="px-5 py-3">Gerelateerde competenties</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Voortgang</th>
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
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-indigo-500"
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-600 w-10 text-right">
                      {goal.progress}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GoalsSection({ goals }: { goals: GrowthGoal[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Leerdoelen</h2>
        <button
          className="rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => {
            // TODO: Implement new goal creation
            alert("Nieuw leerdoel instellen komt binnenkort.");
          }}
        >
          Nieuw leerdoel instellen
        </button>
      </div>
      {!goals || goals.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 text-center">
          <p className="text-sm text-gray-500">
            Je hebt nog geen leerdoelen ingesteld.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {goal.title}
                </h3>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    goal.status === "active"
                      ? "bg-blue-50 text-blue-700 border border-blue-100"
                      : "bg-green-50 text-green-700 border border-green-100"
                  }`}
                >
                  {goal.status === "active" ? "Actief" : "Behaald"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] text-gray-600">
                {goal.related_competencies.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
                  >
                    {c}
                  </span>
                ))}
              </div>
              <div className="mt-2">
                <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                  <span>Voortgang</span>
                  <span>{goal.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full bg-blue-500"
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReflectionsSection({
  reflections,
}: {
  reflections: GrowthReflection[];
}) {
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
        {reflections.map((ref, idx) => (
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
              <p className="text-xs text-slate-600 line-clamp-2">
                {ref.snippet}
              </p>
              <button
                className="mt-1 text-xs font-medium text-indigo-600 hover:underline"
                onClick={() => {
                  // TODO: Implement full reflection view
                  alert("Volledige reflectie weergave komt binnenkort.");
                }}
              >
                Open volledige reflectie
              </button>
            </div>
          </div>
        ))}
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
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className={studentStyles.typography.sectionTitle}>
            AI-samenvatting van jouw groei
          </h2>
          <p className={studentStyles.typography.infoTextSmall}>
            Op basis van jouw scans, leerdoelen en reflecties.
          </p>
        </div>
        <button
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onRegenerate}
          disabled={isRegenerating}
        >
          {isRegenerating ? "Genereren..." : "Samenvatting opnieuw genereren"}
        </button>
      </div>

      {isRegenerating ? (
        <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          <span className="ml-3 text-sm text-slate-600">
            Samenvatting wordt gegenereerd...
          </span>
        </div>
      ) : summary ? (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-sm text-indigo-900">
          <p>{summary}</p>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 text-center">
          <p className="text-sm text-slate-500">
            Er is nog geen AI-samenvatting beschikbaar. Klik op de knop om er
            een te genereren.
          </p>
        </div>
      )}
    </section>
  );
}
