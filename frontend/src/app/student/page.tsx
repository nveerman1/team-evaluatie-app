"use client";

import { useState, useMemo } from "react";
import { useStudentDashboard } from "@/hooks";
import { useStudentProjectAssessments } from "@/hooks/useStudentProjectAssessments";
import { EvaluationCard } from "@/components/student";
import { Loading, ErrorMessage, StatTile, Tabs, Toolbar } from "@/components";
import Link from "next/link";

export default function StudentDashboard() {
  const { dashboard, loading, error } = useStudentDashboard();
  const {
    assessments: projectAssessments,
    loading: projectLoading,
    error: projectError,
  } = useStudentProjectAssessments();

  // Tab state
  const [activeTab, setActiveTab] = useState("evaluaties");

  // Filter states for Evaluaties tab
  const [evaluatiesSearch, setEvaluatiesSearch] = useState("");
  const [evaluatiesStatus, setEvaluatiesStatus] = useState("all");

  // Filter states for Competentiescan tab
  const [competentiescanSearch, setCompetentiescanSearch] = useState("");
  const [competentiescanStatus, setCompetentiescanStatus] = useState("all");

  // Filter states for Projectbeoordelingen tab
  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatus, setProjectStatus] = useState("all");

  // Get open evaluations early (before conditional returns)
  const openEvaluations = dashboard?.openEvaluations || [];

  // Filter evaluations based on search and status
  const filteredEvaluations = useMemo(() => {
    return openEvaluations.filter((evaluation) => {
      const matchesSearch = evaluation.title
        .toLowerCase()
        .includes(evaluatiesSearch.toLowerCase());
      const matchesStatus =
        evaluatiesStatus === "all" ||
        (evaluatiesStatus === "open" && evaluation.status === "open") ||
        (evaluatiesStatus === "closed" && evaluation.status === "closed");
      return matchesSearch && matchesStatus;
    });
  }, [openEvaluations, evaluatiesSearch, evaluatiesStatus]);

  // Filter project assessments based on search
  const filteredProjectAssessments = useMemo(() => {
    return projectAssessments.filter((assessment) => {
      const matchesSearch =
        assessment.title.toLowerCase().includes(projectSearch.toLowerCase()) ||
        (assessment.group_name &&
          assessment.group_name.toLowerCase().includes(projectSearch.toLowerCase()));
      // For now, project assessments are always "published" so we don't filter by status
      return matchesSearch;
    });
  }, [projectAssessments, projectSearch]);

  // Handle stat tile clicks
  const handleStatTileClick = (filter: string) => {
    setActiveTab("evaluaties");
    if (filter === "open") {
      setEvaluatiesStatus("open");
    } else if (filter === "completed") {
      setEvaluatiesStatus("closed");
    } else if (filter === "reflections") {
      // For reflections, show all evaluations but user can see which need reflections
      setEvaluatiesStatus("all");
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!dashboard) return <ErrorMessage message="Kon dashboard niet laden" />;

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Mijn Dashboard</h1>
        <p className="text-gray-600">
          Overzicht van jouw evaluaties en resultaten
        </p>
      </div>

      {/* Self-Assessment Required Message */}
      {dashboard.needsSelfAssessment && (
        <div className="p-6 border rounded-xl bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <div className="text-amber-600 text-xl">⚠️</div>
            <div>
              <h3 className="text-lg font-semibold text-amber-900 mb-1">
                Zelfbeoordeling Vereist
              </h3>
              <p className="text-amber-700">
                Voltooi eerst je zelfbeoordeling voordat je peers kunt beoordelen.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Tiles */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatTile
          icon="📋"
          label="Open Evaluaties"
          value={openEvaluations.length}
          bgColor="bg-blue-50"
          textColor="text-blue-700"
          onClick={() => handleStatTileClick("open")}
        />

        <StatTile
          icon="💭"
          label="Reflecties Open"
          value={dashboard.pendingReflections}
          bgColor="bg-purple-50"
          textColor="text-purple-700"
          onClick={() => handleStatTileClick("reflections")}
        />

        <StatTile
          icon="✅"
          label="Voltooide Evaluaties"
          value={dashboard.completedEvaluations}
          bgColor="bg-green-50"
          textColor="text-green-700"
          onClick={() => handleStatTileClick("completed")}
        />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          {
            id: "evaluaties",
            label: "Evaluaties",
            content: (
              <div>
                <Toolbar
                  searchValue={evaluatiesSearch}
                  onSearchChange={setEvaluatiesSearch}
                  statusFilter={evaluatiesStatus}
                  onStatusFilterChange={setEvaluatiesStatus}
                  showFiltersButton={false}
                />

                {filteredEvaluations.length === 0 ? (
                  <div className="p-8 border rounded-xl bg-gray-50 text-center">
                    <p className="text-gray-500">
                      {evaluatiesSearch || evaluatiesStatus !== "all"
                        ? "Geen evaluaties gevonden met deze filters."
                        : "Geen open evaluaties op dit moment."}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredEvaluations.map((evaluation) => (
                      <EvaluationCard
                        key={evaluation.id}
                        evaluation={evaluation}
                      />
                    ))}
                  </div>
                )}

                {/* Results Section within Evaluaties tab */}
                {dashboard.hasAnyEvaluations && (
                  <div className="mt-8 p-6 border rounded-xl bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold">
                        Peer-feedback Resultaten
                      </h3>
                      <Link
                        href="/student/results"
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Bekijk alle resultaten →
                      </Link>
                    </div>
                    {dashboard.completedEvaluations > 0 ? (
                      <p className="text-gray-600">
                        Je hebt {dashboard.completedEvaluations} voltooide
                        evaluatie
                        {dashboard.completedEvaluations !== 1 ? "s" : ""}. Klik
                        op &apos;Bekijk alle resultaten&apos; om je cijfers en feedback te
                        zien.
                      </p>
                    ) : (
                      <p className="text-gray-600">
                        Je hebt evaluaties toegewezen, maar er zijn nog geen
                        voltooide resultaten beschikbaar. Resultaten worden
                        zichtbaar zodra evaluaties zijn afgesloten.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "competentiescan",
            label: "Competentiescan",
            content: (
              <div>
                <Toolbar
                  searchValue={competentiescanSearch}
                  onSearchChange={setCompetentiescanSearch}
                  statusFilter={competentiescanStatus}
                  onStatusFilterChange={setCompetentiescanStatus}
                  showFiltersButton={false}
                />

                <div className="p-8 border rounded-xl bg-gray-50 text-center">
                  <p className="text-gray-500">
                    Competentiescan functionaliteit wordt binnenkort toegevoegd.
                  </p>
                </div>
              </div>
            ),
          },
          {
            id: "projectbeoordelingen",
            label: "Projectbeoordelingen",
            content: (
              <div>
                <Toolbar
                  searchValue={projectSearch}
                  onSearchChange={setProjectSearch}
                  statusFilter={projectStatus}
                  onStatusFilterChange={setProjectStatus}
                  showFiltersButton={false}
                />

                {projectLoading ? (
                  <div className="p-6 border rounded-xl bg-gray-50">
                    <Loading />
                  </div>
                ) : projectError ? (
                  <div className="p-6 border rounded-xl bg-gray-50">
                    <ErrorMessage message={projectError} />
                  </div>
                ) : filteredProjectAssessments.length === 0 ? (
                  <div className="p-8 border rounded-xl bg-gray-50 text-center">
                    <p className="text-gray-500">
                      {projectSearch
                        ? "Geen projectbeoordelingen gevonden met deze filters."
                        : "Nog geen projectbeoordelingen beschikbaar."}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredProjectAssessments.map((assessment) => (
                      <Link
                        key={assessment.id}
                        href={`/student/project-assessments/${assessment.id}`}
                        className="block p-5 border rounded-xl bg-white hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2">
                              {assessment.title}
                            </h3>
                            <div className="space-y-1 text-sm text-gray-600">
                              <p>Team: {assessment.group_name || "Onbekend"}</p>
                              {assessment.teacher_name && (
                                <p>
                                  Beoordeeld door: {assessment.teacher_name}
                                </p>
                              )}
                              {assessment.published_at && (
                                <p>
                                  Datum gepubliceerd:{" "}
                                  {new Date(
                                    assessment.published_at
                                  ).toLocaleDateString("nl-NL")}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                              Gepubliceerd
                            </span>
                            <span className="text-gray-400">→</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </main>
  );
}
