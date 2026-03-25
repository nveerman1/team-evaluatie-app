"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useStudentDashboard, useCurrentUser, useStudentOverview } from "@/hooks";
import { useStudentProjectAssessments } from "@/hooks/useStudentProjectAssessments";
import { useStudentProjectPlans } from "@/hooks/useStudentProjectPlans";
import { usePeerFeedbackResults } from "@/hooks/usePeerFeedbackResults";
import { Loading, ErrorMessage } from "@/components";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ClipboardCheck, Target, Trophy, BarChart3, Upload, Clock, FileText, MessageSquare, Dumbbell, TrendingUp } from "lucide-react";
import { ProjectAssessmentDashboardCard } from "@/components/student/dashboard/ProjectAssessmentDashboardCard";
import { ProjectPlanDashboardCard } from "@/components/student/dashboard/ProjectPlanDashboardCard";
import { OverviewTab } from "@/components/student/dashboard/OverviewTab";
import { CompetencyScanDashboardTab } from "@/components/student/dashboard/CompetencyScanDashboardTab";
import { AttendanceTab } from "@/components/student/dashboard/AttendanceTab";
import { SkillTrainingTab } from "@/components/student/dashboard/SkillTrainingTab";
import { ProjectFeedbackDashboardTab } from "@/components/student/dashboard/ProjectFeedbackDashboardTab";
import { VoortgangTab } from "@/components/student/dashboard/VoortgangTab";
import { InleverenTab } from "@/components/student/dashboard/InleverenTab";
import { EvaluationsTab } from "@/components/student/dashboard/EvaluationsTab";
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
    { id: "voortgang", label: "Ontwikkeling", icon: TrendingUp },
    { id: "scans", label: "Competentiescan", icon: Target },
    { id: "trainingen", label: "Trainingen", icon: Dumbbell },
  ],
  projecten: [
    { id: "projectplan", label: "Projectplan", icon: FileText },
    { id: "inleveren", label: "Inleveren", icon: Upload },
    { id: "evaluaties", label: "360° feedback", icon: ClipboardCheck },
    { id: "beoordeling", label: "Projectbeoordeling", icon: Trophy },
    { id: "projectevaluatie", label: "Projectevaluatie", icon: MessageSquare },
  ],
} as const;

// Maps each leaf tab value to its parent top-nav id
const TAB_PARENT: Record<string, string> = {
  overzicht: "overzicht",
  voortgang: "competenties",
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
  competenties: "voortgang",
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
      {/* Header */}
      <div className="w-full bg-slate-900 text-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm text-slate-300">Student dashboard</p>
              <h1 className="mt-1 text-4xl font-bold tracking-tight">Mijn dashboard</h1>
              <p className="mt-2 text-sm text-slate-300">
                Bekijk wat nog openstaat en rond je taken stap voor stap af.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur shrink-0">
              <div className="text-right">
                <div className="font-semibold leading-tight">{studentName}</div>
                <div className="text-sm text-slate-300">{studentClass}</div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 font-semibold">
                {studentName.charAt(0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Page container */}
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* Self-Assessment Required Message */}
        {dashboard.needsSelfAssessment && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <div className="text-amber-600 text-xl">⚠️</div>
              <div>
                <h3 className="mb-1 text-lg font-semibold text-amber-900">
                  Zelfbeoordeling Vereist
                </h3>
                <p className="text-amber-700">
                  Voltooi eerst je zelfbeoordeling voordat je peers kunt beoordelen.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation + content */}
        <div>
          {/* ── Two-level navigation ────────────────────────────── */}
          <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
            {/* Top navigation row */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
              {TOP_NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleTopNavClick(id)}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center",
                    activeTopNav === id
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Sub navigation row – only when the active top-nav has sub-items */}
            {SUB_NAV_ITEMS[activeTopNav as keyof typeof SUB_NAV_ITEMS] && (
              <div className="flex flex-wrap gap-2 pt-3">
                {SUB_NAV_ITEMS[activeTopNav as keyof typeof SUB_NAV_ITEMS].map(
                  ({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => handleTabChange(id)}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm transition-colors whitespace-nowrap flex items-center",
                        activeTab === id
                          ? "bg-slate-100 font-semibold text-slate-900 ring-1 ring-slate-200"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      )}
                    >
                      <Icon className="mr-1.5 h-3.5 w-3.5" />
                      {label}
                    </button>
                  )
                )}
              </div>
            )}
          </section>

          {/* ── Tab content ─────────────────────────────────────── */}
          <Tabs value={activeTab} className="mt-6">
            {/* OVERZICHT */}
            <TabsContent value="overzicht" className="space-y-4">
              {overviewLoading ? (
                <Loading />
              ) : (
                <OverviewTab
                  peerResults={peerResults}
                  reflections={overviewData.reflections}
                  projectResults={overviewData.projectResults}
                />
              )}
            </TabsContent>

            {/* VOORTGANG */}
            <TabsContent value="voortgang" className="space-y-4">
              {overviewLoading ? (
                <Loading />
              ) : (
                <VoortgangTab
                  peerResults={peerResults}
                  competencyProfile={overviewData.competencyProfile}
                  learningGoals={overviewData.learningGoals}
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
            <TabsContent value="projectplan">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Projectplannen</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Vul je projectplan in. Na goedkeuring krijg je een GO om te starten.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {projectPlansLoading ? (
                    <Loading />
                  ) : projectPlansError ? (
                    <ErrorMessage message={projectPlansError} />
                  ) : (projectPlans || []).length === 0 ? (
                    <div className="rounded-xl bg-slate-50 p-8 text-center">
                      <p className="text-slate-500">Nog geen projectplannen beschikbaar.</p>
                    </div>
                  ) : (
                    (projectPlans || []).map((projectPlan) => (
                      <ProjectPlanDashboardCard key={projectPlan.id} projectPlan={projectPlan} />
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            {/* INLEVEREN */}
            <TabsContent value="inleveren">
              <InleverenTab
                projectAssessments={projectAssessments}
                projectLoading={projectLoading}
                projectError={projectError}
              />
            </TabsContent>

            {/* 360° FEEDBACK */}
            <TabsContent value="evaluaties">
              <EvaluationsTab evaluations={openEvaluations} />
            </TabsContent>

            {/* BEOORDELING */}
            <TabsContent value="beoordeling">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Projectbeoordeling</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Beoordelingen per project. Klik door voor rubric, feedback en je eindresultaat.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {projectLoading ? (
                    <Loading />
                  ) : projectError ? (
                    <ErrorMessage message={projectError} />
                  ) : (projectAssessments || []).filter((p) => ["open", "published", "closed"].includes(p.status)).length === 0 ? (
                    <div className="rounded-xl bg-slate-50 p-8 text-center">
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
              </div>
            </TabsContent>

            {/* 3DE BLOK */}
            <TabsContent value="derde-blok" className="space-y-4">
              <AttendanceTab />
            </TabsContent>

            {/* PROJECTEVALUATIE */}
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
