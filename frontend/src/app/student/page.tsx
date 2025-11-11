"use client";

import { useState } from "react";
import { useStudentDashboard } from "@/hooks";
import { useStudentProjectAssessments } from "@/hooks/useStudentProjectAssessments";
import { EvaluationCard } from "@/components/student";
import { CompetencyScanTab } from "@/components/student/competency/CompetencyScanTab";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";

// SummaryTile component matching mockup design
const SummaryTile = ({
  icon,
  title,
  value,
  hint,
  color = "bg-white",
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  hint?: string;
  color?: string;
  onClick?: () => void;
}) => {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick}
      className={`rounded-2xl ${color} shadow-sm p-4 border border-gray-50 flex items-center gap-4 w-full transition-all duration-200 ${
        onClick ? "cursor-pointer hover:shadow-md" : ""
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm text-gray-500">{title}</div>
        <div className="text-2xl font-semibold leading-6">{value}</div>
        {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
      </div>
    </Component>
  );
};

export default function StudentDashboard() {
  const { dashboard, loading, error } = useStudentDashboard();
  const {
    assessments: projectAssessments,
    loading: projectLoading,
    error: projectError,
  } = useStudentProjectAssessments();

  // Tab state
  const [activeTab, setActiveTab] = useState<
    "evaluaties" | "competenties" | "projecten"
  >("evaluaties");

  // Get open evaluations early (before conditional returns)
  const openEvaluations = dashboard?.openEvaluations || [];

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!dashboard) return <ErrorMessage message="Kon dashboard niet laden" />;

  const studentName = dashboard.userName || "Leerling";
  const studentClass = dashboard.userClass || "";

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header with student info */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm">
        <header className="px-6 pt-8 pb-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                  Mijn Dashboard
                </h1>
                <p className="text-gray-600 mt-1">
                  Overzicht van jouw evaluaties, reflecties en groei.
                </p>
              </div>
              <div className="text-right mt-3 md:mt-0">
                <div className="text-lg font-medium">{studentName}</div>
                {studentClass && (
                  <div className="text-sm text-gray-500">{studentClass}</div>
                )}
              </div>
            </div>
          </div>
        </header>
      </div>

      <section className="px-6 pt-6 pb-10">
        {/* Self-Assessment Required Message */}
        {dashboard.needsSelfAssessment && (
          <div className="max-w-6xl mx-auto mb-6 p-6 border rounded-xl bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <div className="text-amber-600 text-xl">⚠️</div>
              <div>
                <h3 className="text-lg font-semibold text-amber-900 mb-1">
                  Zelfbeoordeling Vereist
                </h3>
                <p className="text-amber-700">
                  Voltooi eerst je zelfbeoordeling voordat je peers kunt
                  beoordelen.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 w-full">
          <SummaryTile
            icon={<span>📋</span>}
            title="Open Evaluaties"
            value={openEvaluations.length}
            hint={`${openEvaluations.length}/${openEvaluations.length} deze periode`}
            onClick={() => setActiveTab("evaluaties")}
          />
          <SummaryTile
            icon={<span>🧭</span>}
            title="Open Scans"
            value={dashboard.openScans}
            hint="Competentiescan"
            color="bg-green-50"
            onClick={() => setActiveTab("competenties")}
          />
          <SummaryTile
            icon={<span>🆕</span>}
            title="Nieuwe Beoordeling"
            value={dashboard.newAssessments}
            hint={`${dashboard.newAssessments} ${dashboard.newAssessments === 1 ? "nieuw project" : "nieuwe projecten"}`}
            color="bg-orange-50"
            onClick={() => setActiveTab("projecten")}
          />
        </div>

        {/* Tab Navigation */}
        <div className="max-w-6xl mx-auto flex gap-2 bg-gray-200 rounded-2xl p-1 w-full">
          <button
            onClick={() => setActiveTab("evaluaties")}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${
              activeTab === "evaluaties"
                ? "bg-white shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            🧾 Evaluaties
          </button>
          <button
            onClick={() => setActiveTab("competenties")}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${
              activeTab === "competenties"
                ? "bg-white shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            🌱 Competentiescan
          </button>
          <button
            onClick={() => setActiveTab("projecten")}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${
              activeTab === "projecten"
                ? "bg-white shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            🧠 Projectbeoordelingen
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "evaluaties" && (
          <div className="max-w-6xl mx-auto mt-5 space-y-4 w-full transition-all duration-300">

            {/* Peer-feedback Results Card */}
            <div className="rounded-xl border shadow-sm bg-blue-50 p-4 space-y-3 w-full">
              <div className="px-4 py-2 rounded-t-xl font-semibold text-sm bg-blue-200 text-blue-900">
                Peer-feedback resultaten
              </div>
              <div className="text-sm text-gray-700">
                {dashboard.completedEvaluations > 0 ? (
                  <>
                    Je hebt {dashboard.completedEvaluations} voltooide evaluatie
                    {dashboard.completedEvaluations !== 1 ? "s" : ""}. Klik op
                    &apos;Bekijk alle resultaten&apos; om je cijfers en feedback
                    te zien.
                  </>
                ) : (
                  <>
                    Je hebt evaluaties toegewezen, maar nog geen voltooide
                    resultaten. Zodra ze zijn afgerond verschijnen ze hier.
                  </>
                )}
              </div>
              <Link
                href="/student/results"
                className="text-sm text-blue-700 underline"
              >
                Bekijk alle resultaten →
              </Link>
            </div>

            {/* Evaluation Cards */}
            {openEvaluations.length === 0 ? (
              <div className="p-8 border rounded-xl bg-gray-50 text-center">
                <p className="text-gray-500">
                  Geen open evaluaties op dit moment.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {openEvaluations.map((evaluation) => (
                  <EvaluationCard
                    key={evaluation.id}
                    evaluation={evaluation}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "competenties" && (
          <div className="max-w-6xl mx-auto mt-5 space-y-4 w-full transition-all duration-300">

            <CompetencyScanTab />
          </div>
        )}

        {activeTab === "projecten" && (
          <div className="max-w-6xl mx-auto mt-5 space-y-4 w-full transition-all duration-300">

            <div className="rounded-xl border shadow-sm bg-gray-50 p-4 space-y-3 w-full">
              <div className="px-4 py-2 rounded-t-xl font-semibold text-sm bg-gray-200 text-gray-800">
                Projectbeoordelingen
              </div>
              {projectLoading ? (
                <Loading />
              ) : projectError ? (
                <ErrorMessage message={projectError} />
              ) : projectAssessments.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500">
                    Nog geen projectbeoordelingen beschikbaar.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projectAssessments.map((assessment) => (
                    <Link
                      key={assessment.id}
                      href={`/student/project-assessments/${assessment.id}`}
                      className="block border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {assessment.title}
                            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                              Gesloten
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            Team: {assessment.group_name || "Onbekend"} |
                            Beoordeeld door:{" "}
                            {assessment.teacher_name || "Onbekend"}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button className="rounded-lg bg-blue-600 text-white text-sm px-3 py-1.5">
                            Bekijk →
                          </button>
                        </div>
                      </div>
                      {assessment.published_at && (
                        <div className="text-sm text-gray-600 mt-2">
                          Datum gepubliceerd:{" "}
                          {new Date(assessment.published_at).toLocaleDateString(
                            "nl-NL"
                          )}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
