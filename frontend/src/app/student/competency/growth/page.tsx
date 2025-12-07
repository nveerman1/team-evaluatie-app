"use client";

import { useState } from "react";
import { useStudentGrowth } from "@/hooks";
import { usePeerFeedbackResults } from "@/hooks/usePeerFeedbackResults";
import {
  CompetencyRadarChart,
  CATEGORY_COLORS,
} from "@/components/student/competency/CompetencyRadarChart";
import { OMZAOverview } from "@/components/student/peer-results";
import type {
  GrowthGoal,
  GrowthReflection,
  GrowthCategoryScore,
  StudentGrowthData,
} from "@/dtos";
import Link from "next/link";

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
  
  // Fetch peer feedback results for OMZA overview (same as /student/results)
  const { items: peerResults, loading: peerLoading } = usePeerFeedbackResults();

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
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Mijn Groei
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Bekijk hoe jouw competenties, leerdoelen en reflecties zich
              ontwikkelen over meerdere scans.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/student?tab=competenties"
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="mr-2">←</span>
              Terug
            </Link>
            <button
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              onClick={() => {
                // TODO: Implement portfolio export functionality
                alert("Exportfunctie komt binnenkort beschikbaar.");
              }}
            >
              Exporteer voor portfolio
            </button>
          </div>
        </header>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Dev mode indicator when using mock data */}
        {error && !apiData && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-700">
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

            {/* 2. OMZA development over time + Profiel laatste scan */}
            {!peerLoading && peerResults.length > 0 && (
              <div className="-mx-4 sm:-mx-6">
                <OMZAOverview items={peerResults} />
              </div>
            )}

            {/* 3. Goals + Reflections */}
            <section className="grid gap-6 lg:grid-cols-2">
              <GoalsSection goals={data.goals} />
              <ReflectionsSection reflections={data.reflections} />
            </section>

            {/* 4. AI Summary */}
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
}) {
  if (!profile || profile.length === 0) {
    return (
      <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Competentieprofiel
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          Nog geen competentiedata beschikbaar.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Competentieprofiel
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Jouw gemiddelde niveau per competentiecategorie, op basis van
            meerdere scans en leerdoelen.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-600">
          Radardiagram (categorieën)
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
        <div className="space-y-2 text-xs text-gray-600">
          <p className="font-medium text-gray-800 mb-1">
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
                <span className="text-gray-700 font-medium">
                  {cat.value.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-gray-500">
            In de echte versie kun je hier filteren op periode of specifieke
            scans om te zien hoe je profiel verandert.
          </p>
        </div>
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
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">
        Reflecties over mijn groei
      </h2>
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
        {!reflections || reflections.length === 0 ? (
          <p className="text-xs text-gray-500">
            Je hebt nog geen reflecties geschreven. Schrijf na een scan kort op
            wat goed ging en wat je volgende stap is.
          </p>
        ) : (
          <div className="space-y-4">
            {reflections.map((ref, idx) => (
              <div key={ref.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1" />
                  {idx < reflections.length - 1 && (
                    <div className="w-px flex-1 bg-gray-200 mt-1" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-[11px] text-gray-500">{ref.date}</p>
                  <p className="text-sm font-medium text-gray-900">
                    {ref.scan_title}
                  </p>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {ref.snippet}
                  </p>
                  <button
                    className="mt-1 text-[11px] font-medium text-blue-600 hover:underline"
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
        )}
      </div>
    </div>
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
    <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            AI-samenvatting van jouw groei
          </h2>
          <p className="text-xs text-gray-500">
            Op basis van jouw scans, leerdoelen en reflecties.
          </p>
        </div>
        <button
          className="rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onRegenerate}
          disabled={isRegenerating}
        >
          {isRegenerating ? "Genereren..." : "Samenvatting opnieuw genereren"}
        </button>
      </div>

      {isRegenerating ? (
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          <span className="ml-3 text-sm text-gray-600">
            Samenvatting wordt gegenereerd...
          </span>
        </div>
      ) : summary ? (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-900">
          <p>{summary}</p>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-4 text-center">
          <p className="text-sm text-gray-500">
            Er is nog geen AI-samenvatting beschikbaar. Klik op de knop om er
            een te genereren.
          </p>
        </div>
      )}
    </section>
  );
}
