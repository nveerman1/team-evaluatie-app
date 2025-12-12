"use client";

import { useState, useMemo } from "react";
import { useStudentDashboard, useCurrentUser } from "@/hooks";
import { useStudentProjectAssessments } from "@/hooks/useStudentProjectAssessments";
import { usePeerFeedbackResults } from "@/hooks/usePeerFeedbackResults";
import { Loading, ErrorMessage } from "@/components";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ClipboardCheck, Target, Trophy, BarChart3, Sparkles } from "lucide-react";
import { EvaluationDashboardCard } from "@/components/student/dashboard/EvaluationDashboardCard";
import { ProjectAssessmentDashboardCard } from "@/components/student/dashboard/ProjectAssessmentDashboardCard";
import { OverviewTab } from "@/components/student/dashboard/OverviewTab";
import { CompetencyScanTab } from "@/components/student/competency/CompetencyScanTab";
import Link from "next/link";

export default function StudentDashboard() {
  const { dashboard, loading, error } = useStudentDashboard();
  const { user, loading: userLoading } = useCurrentUser();
  const {
    assessments: projectAssessments,
    loading: projectLoading,
    error: projectError,
  } = useStudentProjectAssessments();
  const { items: peerResults } = usePeerFeedbackResults();

  // Tab state
  const [activeTab, setActiveTab] = useState<string>("evaluaties");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Memoize open evaluations to avoid changing on every render
  const openEvaluations = useMemo(() => dashboard?.openEvaluations || [], [dashboard?.openEvaluations]);

  // Filter evaluations by search query
  const filteredEvaluations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return openEvaluations;
    return openEvaluations.filter((e) => e.title.toLowerCase().includes(q));
  }, [openEvaluations, searchQuery]);

  if (loading || userLoading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!dashboard) return <ErrorMessage message="Kon dashboard niet laden" />;

  // Get student name and class from current user (using class_name from API)
  const studentName = user?.name || dashboard.userName || "Leerling";
  const studentClass = user?.class_name || dashboard.userClass || "—";

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header (full width, donker, in lijn met docentenpagina) */}
      <div className="w-full bg-slate-800 text-white shadow-sm">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Mijn Dashboard</h1>
              <p className="mt-1 max-w-xl text-sm text-white/70">
                Overzicht van je evaluaties, ontwikkeling en projectresultaten.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-semibold">{studentName}</div>
                <div className="text-xs text-white/70">{studentClass}</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 font-semibold">
                {studentName.charAt(0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Page container */}
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {/* Self-Assessment Required Message */}
        {dashboard.needsSelfAssessment && (
          <div className="mb-6 p-6 border rounded-xl bg-amber-50 border-amber-200">
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

        {/* Tabs */}
        <div className="mt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList className="h-11 w-full justify-start gap-1 rounded-2xl bg-white p-1 shadow-sm sm:w-auto">
                <TabsTrigger
                  value="evaluaties"
                  className="relative rounded-xl px-4 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  <ClipboardCheck className="mr-2 h-4 w-4" /> Evaluaties
                </TabsTrigger>
                <TabsTrigger
                  value="scans"
                  className="relative rounded-xl px-4 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  <Target className="mr-2 h-4 w-4" /> Competentiescan
                </TabsTrigger>
                <TabsTrigger
                  value="projecten"
                  className="relative rounded-xl px-4 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  <Trophy className="mr-2 h-4 w-4" /> Projectbeoordelingen
                </TabsTrigger>
                <TabsTrigger
                  value="overzicht"
                  className="relative rounded-xl px-4 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  <BarChart3 className="mr-2 h-4 w-4" /> Overzicht
                </TabsTrigger>
              </TabsList>

              {/* Search bar (only for evaluaties tab) */}
              {activeTab === "evaluaties" && (
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Zoek…"
                    className="h-11 rounded-2xl bg-white pl-9 shadow-sm ring-1 ring-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* EVALUATIES */}
            <TabsContent value="evaluaties" className="mt-6 space-y-4">
              {/* Compacte intro */}
              <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-slate-600" />
                        <p className="text-sm font-semibold text-slate-900">
                          Wat moet ik nu doen?
                        </p>
                      </div>
                      <p className="text-sm text-slate-600">
                        Open evaluaties staan bovenaan. Afgeronde evaluaties kun je
                        teruglezen.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="rounded-full bg-indigo-50 text-indigo-700">
                        Open: {openEvaluations.filter((e) => e.status === "open").length}
                      </Badge>
                      <Link href="/student/results">
                        <Badge variant="secondary" className="rounded-full bg-indigo-50 text-indigo-700 cursor-pointer hover:bg-indigo-100">
                          Afgerond: {dashboard.completedEvaluations}
                        </Badge>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4">
                {filteredEvaluations.length === 0 ? (
                  <div className="p-8 rounded-xl shadow-sm bg-slate-50 text-center">
                    <p className="text-slate-500">
                      {searchQuery ? "Geen evaluaties gevonden met deze zoekopdracht." : "Geen open evaluaties op dit moment."}
                    </p>
                  </div>
                ) : (
                  filteredEvaluations.map((evaluation) => (
                    <EvaluationDashboardCard key={evaluation.id} evaluation={evaluation} />
                  ))
                )}
              </div>
            </TabsContent>

            {/* COMPETENTIESCAN */}
            <TabsContent value="scans" className="mt-6 space-y-4">
              <CompetencyScanTab />
            </TabsContent>

            {/* PROJECTBEOORDELINGEN */}
            <TabsContent value="projecten" className="mt-6 space-y-4">
              <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Mijn projectresultaten</h2>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    Beoordelingen per project. Klik door voor rubric, feedback en je eindresultaat.
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-4">
                {projectLoading ? (
                  <Loading />
                ) : projectError ? (
                  <ErrorMessage message={projectError} />
                ) : projectAssessments.length === 0 ? (
                  <div className="p-8 rounded-xl shadow-sm bg-slate-50 text-center">
                    <p className="text-slate-500">
                      Nog geen projectbeoordelingen beschikbaar.
                    </p>
                  </div>
                ) : (
                  projectAssessments.map((assessment) => (
                    <ProjectAssessmentDashboardCard key={assessment.id} assessment={assessment} />
                  ))
                )}
              </div>
            </TabsContent>

            {/* OVERZICHT */}
            <TabsContent value="overzicht" className="mt-6 space-y-4">
              <OverviewTab 
                peerResults={peerResults}
                // TODO: Connect to learning goals API when available
                learningGoals={[]}
                // TODO: Connect to reflections API when available
                reflections={[]}
                // TODO: Connect to project results API when available (with rubric category scores)
                projectResults={[]}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
