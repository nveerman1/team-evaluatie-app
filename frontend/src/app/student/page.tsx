"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useStudentDashboard, useCurrentUser, useStudentOverview } from "@/hooks";
import { useStudentProjectAssessments } from "@/hooks/useStudentProjectAssessments";
import { usePeerFeedbackResults } from "@/hooks/usePeerFeedbackResults";
import { Loading, ErrorMessage } from "@/components";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ClipboardCheck, Target, Trophy, BarChart3, Sparkles, Upload, Clock } from "lucide-react";
import { EvaluationDashboardCard } from "@/components/student/dashboard/EvaluationDashboardCard";
import { ProjectAssessmentDashboardCard } from "@/components/student/dashboard/ProjectAssessmentDashboardCard";
import { SubmissionDashboardCard } from "@/components/student/dashboard/SubmissionDashboardCard";
import { OverviewTab } from "@/components/student/dashboard/OverviewTab";
import { CompetencyScanDashboardTab } from "@/components/student/dashboard/CompetencyScanDashboardTab";
import { AttendanceTab } from "@/components/student/dashboard/AttendanceTab";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

function StudentDashboardContent() {
  const { dashboard, loading, error } = useStudentDashboard();
  const { user, loading: userLoading } = useCurrentUser();
  const {
    assessments: projectAssessments,
    loading: projectLoading,
    error: projectError,
  } = useStudentProjectAssessments();
  const { items: peerResults } = usePeerFeedbackResults();
  const { data: overviewData, isLoading: overviewLoading } = useStudentOverview();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Tab state - check URL query parameter
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<string>(tabFromUrl || "evaluaties");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Update active tab when URL changes
  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Handler to update both state and URL
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/student?tab=${value}`, { scroll: false });
  };

  // Memoize open evaluations to avoid changing on every render
  const openEvaluations = useMemo(() => dashboard?.openEvaluations || [], [dashboard?.openEvaluations]);

  // Filter evaluations by search query
  const filteredEvaluations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return openEvaluations;
    return openEvaluations.filter((e) => e.title.toLowerCase().includes(q));
  }, [openEvaluations, searchQuery]);

  // Filter project assessments by search query and status (only published)
  const filteredProjectAssessments = useMemo(() => {
    // First filter by status - only show published assessments
    const publishedAssessments = (projectAssessments || []).filter((p) => p.status === "published");
    
    // Then filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (!q) return publishedAssessments;
    return publishedAssessments.filter((p) => p.title.toLowerCase().includes(q));
  }, [projectAssessments, searchQuery]);

  // Filter all project assessments by search query only (for Inleveren tab)
  const filteredAllProjectAssessments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projectAssessments || [];
    return (projectAssessments || []).filter((p) => p.title.toLowerCase().includes(q));
  }, [projectAssessments, searchQuery]);

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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-left">
              <h1 className="text-3xl font-bold tracking-tight">Mijn Dashboard</h1>
              <p className="mt-1 max-w-xl text-sm text-white/70">
                Overzicht van je evaluaties, ontwikkeling en projectresultaten.
              </p>
            </div>

            <div className="flex items-center gap-3 sm:self-start">
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
          <Tabs value={activeTab} onValueChange={handleTabChange}>
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
                  value="inleveren"
                  className="relative rounded-xl px-4 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  <Upload className="mr-2 h-4 w-4" /> Inleveren
                </TabsTrigger>
                <TabsTrigger
                  value="overzicht"
                  className="relative rounded-xl px-4 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  <BarChart3 className="mr-2 h-4 w-4" /> Overzicht
                </TabsTrigger>
                <TabsTrigger
                  value="attendance"
                  className="relative rounded-xl px-4 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  <Clock className="mr-2 h-4 w-4" /> 3de Blok
                </TabsTrigger>
              </TabsList>

              {/* Search bar - always visible */}
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Zoek…"
                  className="h-11 rounded-2xl bg-white pl-9 shadow-sm ring-1 ring-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
              </div>
            </div>

            {/* EVALUATIES */}
            <TabsContent value="evaluaties" className="mt-6 space-y-4">
              {/* Compacte intro */}
              <Card className="rounded-2xl border-slate-200 bg-slate-50">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1 flex-1">
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
                    <div className="flex items-center gap-2 shrink-0">
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
              <CompetencyScanDashboardTab searchQuery={searchQuery} />
            </TabsContent>

            {/* PROJECTBEOORDELINGEN */}
            <TabsContent value="projecten" className="mt-6 space-y-4">
              <Card className="rounded-2xl border-slate-200 bg-slate-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-900">Mijn projectresultaten</p>
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
                ) : filteredProjectAssessments.length === 0 ? (
                  <div className="p-8 rounded-xl shadow-sm bg-slate-50 text-center">
                    <p className="text-slate-500">
                      {searchQuery ? "Geen projectbeoordelingen gevonden met deze zoekopdracht." : "Nog geen projectbeoordelingen beschikbaar."}
                    </p>
                  </div>
                ) : (
                  filteredProjectAssessments.map((assessment) => (
                    <ProjectAssessmentDashboardCard key={assessment.id} assessment={assessment} />
                  ))
                )}
              </div>
            </TabsContent>

            {/* INLEVEREN */}
            <TabsContent value="inleveren" className="mt-6 space-y-4">
              <Card className="rounded-2xl border-slate-200 bg-slate-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-900">Inleveringen</p>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    Lever hier je documenten in voor projectbeoordelingen. Upload bestanden naar SharePoint en deel de links.
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-4">
                {projectLoading ? (
                  <Loading />
                ) : projectError ? (
                  <ErrorMessage message={projectError} />
                ) : filteredAllProjectAssessments.filter(a => a.project_id !== null && a.project_id !== undefined).length === 0 ? (
                  <div className="p-8 rounded-xl shadow-sm bg-slate-50 text-center">
                    <p className="text-slate-500">
                      {searchQuery ? "Geen projecten gevonden met deze zoekopdracht." : "Nog geen projecten beschikbaar om in te leveren."}
                    </p>
                  </div>
                ) : (
                  filteredAllProjectAssessments
                    .filter(assessment => assessment.project_id !== null && assessment.project_id !== undefined)
                    .map((assessment) => (
                      <SubmissionDashboardCard key={assessment.id} assessment={assessment} />
                    ))
                )}
              </div>
            </TabsContent>

            {/* OVERZICHT */}
            <TabsContent value="overzicht" className="mt-6 space-y-4">
              {overviewLoading ? (
                <Loading />
              ) : (
                <OverviewTab 
                  peerResults={peerResults}
                  scans={overviewData.scans}
                  competencyProfile={overviewData.competencyProfile}
                  learningGoals={overviewData.learningGoals}
                  reflections={overviewData.reflections}
                  projectResults={overviewData.projectResults}
                />
              )}
            </TabsContent>

            {/* ATTENDANCE / 3DE BLOK */}
            <TabsContent value="attendance" className="mt-6 space-y-4">
              <AttendanceTab searchQuery={searchQuery} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  return (
    <Suspense fallback={<Loading />}>
      <StudentDashboardContent />
    </Suspense>
  );
}
