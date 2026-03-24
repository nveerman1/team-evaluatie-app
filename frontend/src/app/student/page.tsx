"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useStudentDashboard, useCurrentUser, useStudentOverview } from "@/hooks";
import { useStudentProjectAssessments } from "@/hooks/useStudentProjectAssessments";
import { useStudentProjectPlans } from "@/hooks/useStudentProjectPlans";
import { usePeerFeedbackResults } from "@/hooks/usePeerFeedbackResults";
import { Loading, ErrorMessage } from "@/components";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Target, Trophy, BarChart3, Sparkles, Upload, Clock, FileText, MessageSquare, Dumbbell } from "lucide-react";
import { EvaluationDashboardCard } from "@/components/student/dashboard/EvaluationDashboardCard";
import { ProjectAssessmentDashboardCard } from "@/components/student/dashboard/ProjectAssessmentDashboardCard";
import { ProjectPlanDashboardCard } from "@/components/student/dashboard/ProjectPlanDashboardCard";
import { SubmissionDashboardCard } from "@/components/student/dashboard/SubmissionDashboardCard";
import { OverviewTab } from "@/components/student/dashboard/OverviewTab";
import { CompetencyScanDashboardTab } from "@/components/student/dashboard/CompetencyScanDashboardTab";
import { AttendanceTab } from "@/components/student/dashboard/AttendanceTab";
import { SkillTrainingTab } from "@/components/student/dashboard/SkillTrainingTab";
import { ProjectFeedbackDashboardTab } from "@/components/student/dashboard/ProjectFeedbackDashboardTab";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// ── Navigation configuration ────────────────────────────────────────────────

const TOP_NAV_ITEMS = [
  { id: "overzicht", label: "Overzicht", icon: BarChart3 },
  { id: "competenties", label: "Competenties", icon: Target, defaultSub: "scans" },
  { id: "projecten", label: "Projecten", icon: Trophy, defaultSub: "projectplan" },
  { id: "derde-blok", label: "3de blok", icon: Clock },
] as const;

const SUB_NAV_ITEMS = {
  competenties: [
    { id: "scans", label: "Competentiescan", icon: Target },
    { id: "trainingen", label: "Trainingen", icon: Dumbbell },
  ],
  projecten: [
    { id: "projectplan", label: "Projectplan", icon: FileText },
    { id: "inleveren", label: "Inleveren", icon: Upload },
    { id: "evaluaties", label: "360° feedback", icon: ClipboardCheck },
    { id: "beoordeling", label: "Beoordeling", icon: Trophy },
    { id: "projectevaluatie", label: "Projectevaluatie", icon: MessageSquare },
  ],
} as const;

// Maps each leaf tab value to its parent top-nav id
const TAB_PARENT: Record<string, string> = {
  overzicht: "overzicht",
  scans: "competenties",
  trainingen: "competenties",
  projectplan: "projecten",
  inleveren: "projecten",
  evaluaties: "projecten",
  beoordeling: "projecten",
  projectevaluatie: "projecten",
  "derde-blok": "derde-blok",
};

// Default leaf tab for each top-nav item
const TOP_NAV_DEFAULT: Record<string, string> = {
  overzicht: "overzicht",
  competenties: "scans",
  projecten: "projectplan",
  "derde-blok": "derde-blok",
};

// Backward-compatibility mapping for legacy tab values
const LEGACY_TAB_MAP: Record<string, string> = {
  attendance: "derde-blok",
  projectfeedback: "projectevaluatie",
  projectplannen: "projectplan",
  projecten: "beoordeling",
};

function resolveTab(raw: string | null): string {
  if (!raw) return "overzicht";
  if (LEGACY_TAB_MAP[raw]) return LEGACY_TAB_MAP[raw];
  // If a top-nav id was passed directly, resolve to its default leaf
  if (TOP_NAV_DEFAULT[raw] && !TAB_PARENT[raw]) return TOP_NAV_DEFAULT[raw];
  return raw;
}

function StudentDashboardContent() {
  const { dashboard, loading, error } = useStudentDashboard();
  const { user, loading: userLoading } = useCurrentUser();
  const {
    assessments: projectAssessments,
    loading: projectLoading,
    error: projectError,
  } = useStudentProjectAssessments();
  const {
    projectPlans,
    loading: projectPlansLoading,
    error: projectPlansError,
  } = useStudentProjectPlans();
  const { items: peerResults } = usePeerFeedbackResults();
  const { data: overviewData, isLoading: overviewLoading } = useStudentOverview();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Tab state - resolve URL param (including legacy values)
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<string>(resolveTab(tabFromUrl));

  // Update active tab when URL changes
  useEffect(() => {
    setActiveTab(resolveTab(tabFromUrl));
  }, [tabFromUrl]);

  // Derive the active top-nav item from the current leaf tab
  const activeTopNav = TAB_PARENT[activeTab] ?? "overzicht";

  // Handler to update both state and URL
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/student?tab=${value}`, { scroll: false });
  };

  // Clicking a top-nav item navigates to its default leaf tab
  const handleTopNavClick = (topId: string) => {
    const leafTab = TOP_NAV_DEFAULT[topId] ?? topId;
    handleTabChange(leafTab);
  };

  // Memoize open and closed evaluations to avoid changing on every render
  // Include both open and closed evaluations for display
  const openEvaluations = useMemo(() => dashboard?.openEvaluations || [], [dashboard?.openEvaluations]);

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

        {/* Navigation + content */}
        <div className="mt-6">
          {/* ── Two-level navigation ────────────────────────────── */}
          <div className="bg-white shadow-sm rounded-2xl overflow-hidden">
            {/* Top navigation row */}
            <div className="flex gap-1 p-1 overflow-x-auto flex-nowrap">
            {TOP_NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => handleTopNavClick(id)}
                    className={cn(
                      "relative rounded-xl px-4 h-9 flex items-center text-sm font-medium transition-colors whitespace-nowrap",
                      activeTopNav === id
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                  </button>
                ))}
            </div>

            {/* Sub navigation row – only when the active top-nav has sub-items */}
            {SUB_NAV_ITEMS[activeTopNav as keyof typeof SUB_NAV_ITEMS] && (
              <div className="flex gap-1 px-1 pb-1 border-t border-slate-100 overflow-x-auto flex-nowrap">
                {SUB_NAV_ITEMS[activeTopNav as keyof typeof SUB_NAV_ITEMS].map(
                  ({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => handleTabChange(id)}
                      className={cn(
                        "relative rounded-lg px-3 h-8 flex items-center text-sm transition-colors whitespace-nowrap",
                        activeTab === id
                          ? "bg-slate-700 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                      )}
                    >
                      <Icon className="mr-1.5 h-3.5 w-3.5" />
                      {label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {/* ── Tab content ─────────────────────────────────────── */}
          <Tabs value={activeTab} className="mt-6">
            {/* OVERZICHT */}
            <TabsContent value="overzicht" className="space-y-4">
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

            {/* COMPETENTIESCAN */}
            <TabsContent value="scans" className="space-y-4">
              <CompetencyScanDashboardTab />
            </TabsContent>

            {/* TRAININGEN */}
            <TabsContent value="trainingen" className="space-y-4">
              <SkillTrainingTab />
            </TabsContent>

            {/* PROJECTPLAN */}
            <TabsContent value="projectplan" className="space-y-4">
              <Card className="rounded-2xl border-slate-200 bg-slate-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-900">Mijn projectplannen</p>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    Vul hier je projectplan in. Na goedkeuring door de docent krijg je een GO om te starten.
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-4">
                {projectPlansLoading ? (
                  <Loading />
                ) : projectPlansError ? (
                  <ErrorMessage message={projectPlansError} />
                ) : (projectPlans || []).length === 0 ? (
                  <div className="p-8 rounded-xl shadow-sm bg-slate-50 text-center">
                    <p className="text-slate-500">Nog geen projectplannen beschikbaar.</p>
                  </div>
                ) : (
                  (projectPlans || []).map((projectPlan) => (
                    <ProjectPlanDashboardCard key={projectPlan.id} projectPlan={projectPlan} />
                  ))
                )}
              </div>
            </TabsContent>

            {/* INLEVEREN */}
            <TabsContent value="inleveren" className="space-y-4">
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
                ) : (projectAssessments || []).filter(a => a.project_id !== null && a.project_id !== undefined).length === 0 ? (
                  <div className="p-8 rounded-xl shadow-sm bg-slate-50 text-center">
                    <p className="text-slate-500">Nog geen projecten beschikbaar om in te leveren.</p>
                  </div>
                ) : (
                  (projectAssessments || [])
                    .filter(assessment => assessment.project_id !== null && assessment.project_id !== undefined)
                    .map((assessment) => (
                      <SubmissionDashboardCard key={assessment.id} assessment={assessment} />
                    ))
                )}
              </div>
            </TabsContent>

            {/* 360° FEEDBACK (was: Evaluaties) */}
            <TabsContent value="evaluaties" className="space-y-4">
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
                {openEvaluations.length === 0 ? (
                  <div className="p-8 rounded-xl shadow-sm bg-slate-50 text-center">
                    <p className="text-slate-500">Geen open evaluaties op dit moment.</p>
                  </div>
                ) : (
                  openEvaluations.map((evaluation) => (
                    <EvaluationDashboardCard key={evaluation.id} evaluation={evaluation} />
                  ))
                )}
              </div>
            </TabsContent>

            {/* BEOORDELING (was: Projectbeoordelingen) */}
            <TabsContent value="beoordeling" className="space-y-4">
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
                ) : (projectAssessments || []).filter((p) => ["open", "published", "closed"].includes(p.status)).length === 0 ? (
                  <div className="p-8 rounded-xl shadow-sm bg-slate-50 text-center">
                    <p className="text-slate-500">Nog geen projectbeoordelingen beschikbaar.</p>
                  </div>
                ) : (
                  (projectAssessments || [])
                    .filter((p) => ["open", "published", "closed"].includes(p.status))
                    .map((assessment) => (
                      <ProjectAssessmentDashboardCard key={assessment.id} assessment={assessment} />
                    ))
                )}
              </div>
            </TabsContent>

            {/* 3DE BLOK */}
            <TabsContent value="derde-blok" className="space-y-4">
              <AttendanceTab />
            </TabsContent>

            {/* PROJECTEVALUATIE (was: Projectfeedback) */}
            <TabsContent value="projectevaluatie" className="space-y-4">
              <ProjectFeedbackDashboardTab />
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
