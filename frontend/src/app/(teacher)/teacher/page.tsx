"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { evaluationService, projectAssessmentService, competencyService, taskService } from "@/services";
import type { Evaluation } from "@/dtos/evaluation.dto";
import type { ProjectAssessmentListItem } from "@/dtos/project-assessment.dto";
import type { CompetencyWindow } from "@/dtos/competency.dto";
import type { Task } from "@/dtos/task.dto";
import { Loading } from "@/components";
import { formatDate } from "@/utils";
import { CollapsibleSection } from "@/components/teacher/CollapsibleSection";
import { ListRow } from "@/components/teacher/ListRow";
import { PillTabs } from "@/components/teacher/PillTabs";
import { KpiTile } from "@/components/teacher/KpiTile";

export default function TeacherDashboard() {
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [projectAssessments, setProjectAssessments] = useState<ProjectAssessmentListItem[]>([]);
  const [competencyWindows, setCompetencyWindows] = useState<CompetencyWindow[]>([]);
  const [openTasksCount, setOpenTasksCount] = useState<number>(0);
  const [tasksHint, setTasksHint] = useState<string>("Opdrachtgeverstaken");

  // Tab states for collapsible sections
  const [taskTab, setTaskTab] = useState<"week" | "deadlines" | "clients">("week");
  const [evalTab, setEvalTab] = useState<"evaluations" | "projects" | "scans">("evaluations");

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        // Load all evaluations
        const evalsData = await evaluationService.getEvaluations({});
        setEvaluations(Array.isArray(evalsData) ? evalsData : []);

        // Load project assessments
        const projectsData = await projectAssessmentService.getProjectAssessments();
        setProjectAssessments(projectsData?.items || []);

        // Load competency windows
        const windowsData = await competencyService.getWindows("open");
        setCompetencyWindows(Array.isArray(windowsData) ? windowsData : []);
        
        // Load open opdrachtgever tasks
        try {
          const tasksData = await taskService.listTasks({
            type: "opdrachtgever",
            status: "open",
            per_page: 100, // Get all for count
          });
          setOpenTasksCount(tasksData?.total || 0);
          
          // Create hint with first few client names
          if (tasksData?.items && tasksData.items.length > 0) {
            const clientNames = tasksData.items
              .map(t => t.client_name)
              .filter((name): name is string => !!name)
              .slice(0, 3);
            if (clientNames.length > 0) {
              setTasksHint(clientNames.join(", "));
            }
          }
        } catch (taskError) {
          console.error("Error loading tasks:", taskError);
          // Don't fail the whole dashboard if tasks fail to load
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <main className="p-6 max-w-7xl mx-auto">
        <Loading />
      </main>
    );
  }

  // Filter evaluations by status
  const activeEvaluations = evaluations.filter((e) => e.status === "open");

  // Get upcoming deadlines (evaluations with deadlines in the future)
  const now = new Date();

  // Collect deadlines from evaluations
  const evaluationDeadlines = evaluations
    .map((e) => {
      const reviewDeadline = e.deadlines?.review ? new Date(e.deadlines.review) : null;
      const reflectionDeadline = e.deadlines?.reflection ? new Date(e.deadlines.reflection) : null;

      // Get the earliest upcoming deadline
      let nextDeadline = null;
      let nextDeadlineType = "";

      if (reviewDeadline && reviewDeadline > now) {
        nextDeadline = reviewDeadline;
        nextDeadlineType = "Review";
      }

      if (reflectionDeadline && reflectionDeadline > now) {
        if (!nextDeadline || reflectionDeadline < nextDeadline) {
          nextDeadline = reflectionDeadline;
          nextDeadlineType = "Reflectie";
        }
      }

      return {
        type: "evaluation" as const,
        id: e.id,
        title: e.title,
        nextDeadline,
        nextDeadlineType,
        link: `/teacher/evaluations/${e.id}/dashboard`,
      };
    })
    .filter((item) => item.nextDeadline !== null);

  // Collect deadlines from competency windows
  const competencyDeadlines = competencyWindows
    .map((w) => {
      const endDate = w.end_date ? new Date(w.end_date) : null;

      if (endDate && endDate > now) {
        return {
          type: "competency" as const,
          id: w.id,
          title: w.title,
          nextDeadline: endDate,
          nextDeadlineType: "Einddatum",
          link: `/teacher/competencies/windows/${w.id}`,
        };
      }

      return null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // Combine and sort all deadlines
  const upcomingDeadlines = [...evaluationDeadlines, ...competencyDeadlines]
    .sort((a, b) => {
      if (!a.nextDeadline || !b.nextDeadline) return 0;
      return a.nextDeadline.getTime() - b.nextDeadline.getTime();
    })
    .slice(0, 5);

  // Get recent project assessments (this week)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const recentProjects = projectAssessments
    .filter((p) => {
      const updatedAt = p.updated_at ? new Date(p.updated_at) : null;
      return updatedAt && updatedAt >= oneWeekAgo;
    })
    .slice(0, 5);

  // Calculate time remaining for deadline
  const getTimeRemaining = (deadline: Date | null): string => {
    if (!deadline) return "";
    const currentTime = new Date();
    const diff = deadline.getTime() - currentTime.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return "Verlopen";
    if (days === 0) return "Vandaag";
    if (days === 1) return "1 dag";
    return `${days} dagen`;
  };

  // Count deadlines this week
  const deadlinesThisWeek = upcomingDeadlines.filter((d) => {
    if (!d.nextDeadline) return false;
    const daysUntil = Math.floor((d.nextDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 7;
  });

  // Count review vs reflection deadlines
  const reviewCount = deadlinesThisWeek.filter((d) => d.nextDeadlineType === "Review").length;
  const reflectionCount = deadlinesThisWeek.filter((d) => d.nextDeadlineType === "Reflectie").length;

  // Scans count (competency windows)
  const openScans = competencyWindows.length;

  // KPI data
  const kpiData = {
    openEvaluations: activeEvaluations.length,
    openEvaluationsHint:
      activeEvaluations.length > 0
        ? `${activeEvaluations.filter((e) => e.deadlines?.review).length} review, ${activeEvaluations.filter((e) => e.deadlines?.reflection).length} reflectie`
        : "Geen open evaluaties",
    deadlinesThisWeek: deadlinesThisWeek.length,
    deadlinesHint:
      deadlinesThisWeek.length > 0
        ? `${reviewCount} review, ${reflectionCount} reflectie`
        : "Geen deadlines deze week",
    clientTasks: openTasksCount,
    clientTasksHint: tasksHint,
    openScans: openScans,
    openScansHint:
      openScans > 0 ? `${openScans} competentiescan${openScans > 1 ? "s" : ""} actief` : "Geen open scans",
  };

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Snel overzicht van je lopende evaluaties, deadlines en scans.
          </p>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* KPI Tiles Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiTile label="Open evaluaties" value={kpiData.openEvaluations} hint={kpiData.openEvaluationsHint} />
          <KpiTile
            label="Deadlines deze week"
            value={kpiData.deadlinesThisWeek}
            hint={kpiData.deadlinesHint}
          />
          <KpiTile label="Opdrachtgeverstaken" value={kpiData.clientTasks} hint={kpiData.clientTasksHint} />
          <KpiTile label="Open scans" value={kpiData.openScans} hint={kpiData.openScansHint} />
        </div>

        {/* Single Column Layout */}
        <div className="flex flex-col gap-6">
          {/* Snelle acties Card */}
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-900">Snelle acties</h2>
            <p className="text-[13px] text-gray-500 mb-4">Start direct een nieuwe evaluatie of scan.</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/teacher/projects/new"
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 transition-colors"
              >
                + Nieuw project (met evaluaties)
              </Link>
              <Link
                href="/teacher/project-assessments/create"
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                + Nieuwe projectbeoordeling
              </Link>
              <Link
                href="/teacher/evaluations/create"
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                + Nieuwe peerevaluatie
              </Link>
              <Link
                href="/teacher/competencies/windows/create"
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                + Nieuwe competentiescan
              </Link>
            </div>
          </section>

          {/* Vandaag & deze week - Collapsible Section */}
          <CollapsibleSection
            title="Vandaag & deze week"
            subtitle="Taken voor leerlingen, deadlines en opdrachtgever-communicatie."
            defaultOpen={true}
          >
            <PillTabs
              tabs={[
                { id: "week", label: "Deze week" },
                { id: "deadlines", label: "Deadlines" },
                { id: "clients", label: "Opdrachtgevers" },
              ]}
              activeTab={taskTab}
              onTabChange={setTaskTab}
            />

            <div className="space-y-2">
              {taskTab === "week" && (
                <>
                  {activeEvaluations.length > 0 ? (
                    activeEvaluations.slice(0, 3).map((evaluation) => (
                      <ListRow
                        key={evaluation.id}
                        title={`${evaluation.title} (${evaluation.cluster || "—"})`}
                        meta={`Reviewperiode ${formatDate(evaluation.deadlines?.review)}`}
                        href={`/teacher/evaluations/${evaluation.id}/dashboard`}
                        right={
                          <span className="px-3 py-1 text-[11px] rounded-full bg-blue-600 text-white">
                            Plan tijdslot
                          </span>
                        }
                      />
                    ))
                  ) : (
                    <p className="text-[13px] text-gray-400 py-4 text-center">Geen taken deze week.</p>
                  )}
                  {competencyWindows.length > 0 && (
                    <ListRow
                      title={`${competencyWindows[0].title}: check openstaande scans`}
                      meta="Nog leerlingen niet klaar"
                      href={`/teacher/competencies/windows/${competencyWindows[0].id}`}
                      right={
                        <span className="px-3 py-1 text-[11px] rounded-full border border-gray-200 bg-white text-gray-600">
                          Bekijk lijst
                        </span>
                      }
                    />
                  )}
                </>
              )}

              {taskTab === "deadlines" && (
                <>
                  {upcomingDeadlines.length > 0 ? (
                    upcomingDeadlines.slice(0, 5).map((deadline) => {
                      const daysText = getTimeRemaining(deadline.nextDeadline);
                      const isToday = daysText === "Vandaag";
                      return (
                        <ListRow
                          key={`${deadline.type}-${deadline.id}`}
                          title={deadline.title}
                          meta={`${deadline.nextDeadlineType} sluit ${formatDate(deadline.nextDeadline ? deadline.nextDeadline.toISOString() : null)} • ${daysText}`}
                          href={deadline.link}
                          right={
                            <span
                              className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${
                                isToday
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {daysText}
                            </span>
                          }
                        />
                      );
                    })
                  ) : (
                    <p className="text-[13px] text-gray-400 py-4 text-center">Geen aankomende deadlines.</p>
                  )}
                </>
              )}

              {taskTab === "clients" && <ClientTasksContent />}
            </div>
          </CollapsibleSection>

          {/* Lopende processen - Collapsible Section */}
          <CollapsibleSection
            title="Lopende processen"
            subtitle="Overzicht van actieve evaluaties, projectbeoordelingen en scans."
            defaultOpen={true}
          >
            <PillTabs
              tabs={[
                { id: "evaluations", label: "Evaluaties" },
                { id: "projects", label: "Projectbeoordelingen" },
                { id: "scans", label: "Scans" },
              ]}
              activeTab={evalTab}
              onTabChange={setEvalTab}
            />

            <div className="space-y-2">
              {evalTab === "evaluations" && (
                <>
                  {activeEvaluations.length > 0 ? (
                    activeEvaluations.slice(0, 5).map((evaluation) => (
                      <ListRow
                        key={evaluation.id}
                        title={`${evaluation.title} (${evaluation.status})`}
                        meta={`Review: ${formatDate(evaluation.deadlines?.review) || "—"} • Reflectie: ${formatDate(evaluation.deadlines?.reflection) || "—"}`}
                        href={`/teacher/evaluations/${evaluation.id}/dashboard`}
                        right={
                          <div className="flex gap-2">
                            <span className="px-3 py-1 text-[11px] rounded-full border border-gray-200 bg-white text-gray-600">
                              Dashboard
                            </span>
                            <span className="px-3 py-1 text-[11px] rounded-full border border-gray-200 bg-white text-gray-600">
                              Instellingen
                            </span>
                          </div>
                        }
                      />
                    ))
                  ) : (
                    <p className="text-[13px] text-gray-400 py-4 text-center">Geen actieve evaluaties.</p>
                  )}
                </>
              )}

              {evalTab === "projects" && (
                <>
                  {recentProjects.length > 0 ? (
                    recentProjects.map((project) => (
                      <ListRow
                        key={project.id}
                        title={project.title}
                        meta={`${project.group_name || "—"} • ${project.course_name || "—"}`}
                        href={`/teacher/project-assessments/${project.id}/overview`}
                        right={
                          <span className="px-3 py-1 text-[11px] rounded-full border border-gray-200 bg-white text-gray-600">
                            Bekijk
                          </span>
                        }
                      />
                    ))
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-[13px] text-gray-400 mb-2">
                        Geen recente projectbeoordelingen deze week.
                      </p>
                      <Link
                        href="/teacher/project-assessments"
                        className="text-[13px] text-blue-600 hover:underline"
                      >
                        Bekijk alle projectbeoordelingen →
                      </Link>
                    </div>
                  )}
                </>
              )}

              {evalTab === "scans" && (
                <>
                  {competencyWindows.length > 0 ? (
                    competencyWindows.slice(0, 5).map((window) => (
                      <ListRow
                        key={window.id}
                        title={window.title}
                        meta={`Periode: ${formatDate(window.start_date)} - ${formatDate(window.end_date)} • Status: ${window.status || "open"}`}
                        href={`/teacher/competencies/windows/${window.id}`}
                        right={
                          <span className="px-3 py-1 text-[11px] rounded-full border border-gray-200 bg-white text-gray-600">
                            Bekijk
                          </span>
                        }
                      />
                    ))
                  ) : (
                    <p className="text-[13px] text-gray-400 py-4 text-center">Geen actieve scans.</p>
                  )}
                </>
              )}
            </div>
          </CollapsibleSection>
        </div>
      </main>
    </>
  );
}

// Client Tasks Content Component for the "Opdrachtgevers" tab
function ClientTasksContent() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTasks() {
      setLoading(true);
      setError(null);
      try {
        // Get opdrachtgever tasks with status "open", sorted by due_date
        const response = await taskService.listTasks({
          type: "opdrachtgever",
          status: "open",
          per_page: 10,
        });
        setTasks(response.items || []);
      } catch (err) {
        console.error("Error loading tasks:", err);
        setError("Kon taken niet laden");
      } finally {
        setLoading(false);
      }
    }

    loadTasks();
  }, []);

  const handleOpenMail = (task: Task) => {
    const mailtoLink = taskService.generateMailtoLink(task);
    window.location.href = mailtoLink;
  };

  const handleMarkAsDone = async (taskId: number) => {
    try {
      await taskService.completeTask(taskId);
      // Remove task from list after marking as done
      setTasks(tasks.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error("Error marking task as done:", err);
    }
  };

  if (loading) {
    return (
      <div className="py-4 text-center">
        <p className="text-[13px] text-gray-400">Laden...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-center">
        <p className="text-[13px] text-red-500">{error}</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-[13px] text-gray-400 mb-2">Geen opdrachtgever-taken op dit moment.</p>
        <Link
          href="/teacher/tasks/kanban"
          className="text-[13px] text-blue-600 hover:underline"
        >
          Bekijk alle taken →
        </Link>
      </div>
    );
  }

  // Format due date for display
  const formatDueDate = (dueDateStr?: string): string => {
    if (!dueDateStr) return "Geen deadline";
    const dueDate = new Date(dueDateStr);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "Verlopen";
    if (diffDays === 0) return "Vandaag";
    if (diffDays === 1) return "Morgen";
    if (diffDays <= 7) return `Over ${diffDays} dagen`;
    
    return dueDate.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  };

  return (
    <>
      {tasks.map((task) => {
        const canEmail = task.email_to || task.client_email;
        const daysText = formatDueDate(task.due_date);
        const isUrgent = task.due_date && new Date(task.due_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        return (
          <ListRow
            key={task.id}
            title={task.title}
            meta={`${task.client_name || "—"} • ${daysText}`}
            onClick={canEmail ? () => handleOpenMail(task) : undefined}
            right={
              <div className="flex gap-2">
                {canEmail && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenMail(task);
                    }}
                    className={`px-3 py-1 text-[11px] rounded-full ${
                      isUrgent
                        ? "bg-orange-600 text-white"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    Open in Outlook
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAsDone(task.id);
                  }}
                  className="px-3 py-1 text-[11px] rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                >
                  Klaar
                </button>
              </div>
            }
          />
        );
      })}
      
      {tasks.length >= 3 && (
        <div className="pt-2 text-center">
          <Link
            href="/teacher/tasks/kanban"
            className="text-[13px] text-blue-600 hover:underline"
          >
            Bekijk alle taken →
          </Link>
        </div>
      )}
    </>
  );
}
