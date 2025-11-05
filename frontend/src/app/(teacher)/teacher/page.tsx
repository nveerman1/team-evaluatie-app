"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { evaluationService, projectAssessmentService, competencyService } from "@/services";
import type { Evaluation } from "@/dtos/evaluation.dto";
import type { ProjectAssessmentListItem } from "@/dtos/project-assessment.dto";
import type { CompetencyWindow } from "@/dtos/competency.dto";
import { Loading, StatusBadge } from "@/components";
import { formatDate } from "@/utils";

export default function TeacherDashboard() {
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [projectAssessments, setProjectAssessments] = useState<ProjectAssessmentListItem[]>([]);
  const [competencyWindows, setCompetencyWindows] = useState<CompetencyWindow[]>([]);

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
  const draftEvaluations = evaluations.filter((e) => e.status === "draft");
  const closedEvaluations = evaluations.filter((e) => e.status === "closed");

  // Get upcoming deadlines (evaluations with deadlines in the future)
  const now = new Date();
  const upcomingDeadlines = evaluations
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
      
      return { evaluation: e, nextDeadline, nextDeadlineType };
    })
    .filter((item) => item.nextDeadline !== null)
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
  const getTimeRemaining = (deadline: string | undefined): string => {
    if (!deadline) return "";
    const deadlineDate = new Date(deadline);
    const currentTime = new Date();
    const diff = deadlineDate.getTime() - currentTime.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return "Verlopen";
    if (days === 0) return "Vandaag";
    if (days === 1) return "1 dag";
    return `${days} dagen`;
  };

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold mb-2">Teacher Dashboard</h1>
        <p className="text-gray-600">
          Welkom 👋 — Hier vind je een overzicht van alle actieve evaluaties, projecten en deadlines.
        </p>
      </header>

      {/* Quick Actions */}
      <section className="bg-white border rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-4">🧩 Snelle acties</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/teacher/project-assessments/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white hover:opacity-90"
          >
            ➕ Nieuwe projectbeoordeling
          </Link>
          <Link
            href="/teacher/evaluations/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-white hover:opacity-90"
          >
            ➕ Nieuwe peerevaluatie
          </Link>
          <Link
            href="/teacher/competencies/windows/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-700 text-white hover:opacity-90"
          >
            ➕ Nieuw competentievenster
          </Link>
          <Link
            href="/teacher/rubrics/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-600 text-white hover:opacity-90"
          >
            ➕ Nieuwe peer rubric
          </Link>
          <Link
            href="/teacher/rubrics/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-500 text-white hover:opacity-90"
          >
            ➕ Nieuwe project rubric
          </Link>
        </div>
      </section>

      {/* Upcoming Deadlines */}
      <section className="bg-white border rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-4">📅 Aankomende deadlines</h2>
        {upcomingDeadlines.length > 0 ? (
          <div className="space-y-3">
            {upcomingDeadlines.map((item) => {
              const deadlineStr = item.nextDeadline?.toISOString();
              return (
                <div
                  key={item.evaluation.id}
                  className="flex items-center justify-between p-4 border rounded-xl"
                >
                  <div className="flex-1">
                    <div className="font-medium">{item.evaluation.title}</div>
                    <div className="text-sm text-gray-600">
                      {item.nextDeadlineType}: {formatDate(deadlineStr)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-blue-600">
                      {getTimeRemaining(deadlineStr)}
                    </div>
                    <Link
                      href={`/teacher/evaluations/${item.evaluation.id}/dashboard`}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      Bekijk →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Geen aankomende deadlines.</p>
        )}
      </section>

      {/* Active Evaluations */}
      <section className="bg-white border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">🧭 Actieve evaluaties</h2>
          <Link
            href="/teacher/evaluations"
            className="text-sm text-blue-600 hover:underline"
          >
            Bekijk alle →
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 border rounded-xl bg-green-50">
            <div className="text-sm text-green-700 font-medium">Open</div>
            <div className="text-3xl font-bold text-green-900">{activeEvaluations.length}</div>
          </div>
          <div className="p-4 border rounded-xl bg-yellow-50">
            <div className="text-sm text-yellow-700 font-medium">Draft</div>
            <div className="text-3xl font-bold text-yellow-900">{draftEvaluations.length}</div>
          </div>
          <div className="p-4 border rounded-xl bg-gray-50">
            <div className="text-sm text-gray-700 font-medium">Gesloten</div>
            <div className="text-3xl font-bold text-gray-900">{closedEvaluations.length}</div>
          </div>
        </div>

        {activeEvaluations.length > 0 ? (
          <div className="space-y-3">
            {activeEvaluations.slice(0, 5).map((evaluation) => (
              <div
                key={evaluation.id}
                className="p-4 border rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{evaluation.title}</h3>
                      <StatusBadge status={evaluation.status} />
                    </div>
                    <div className="text-sm text-gray-600">
                      Course: {evaluation.cluster || "—"}
                    </div>
                    {evaluation.deadlines && (
                      <div className="text-sm text-gray-500 mt-1">
                        {evaluation.deadlines.review && (
                          <span className="mr-4">
                            Review: {formatDate(evaluation.deadlines.review)} 
                            ({getTimeRemaining(evaluation.deadlines.review)})
                          </span>
                        )}
                        {evaluation.deadlines.reflection && (
                          <span>
                            Reflectie: {formatDate(evaluation.deadlines.reflection)}
                            ({getTimeRemaining(evaluation.deadlines.reflection)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/teacher/evaluations/${evaluation.id}/dashboard`}
                      className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-100"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href={`/teacher/evaluations/${evaluation.id}/settings`}
                      className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-100"
                    >
                      Instellingen
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Geen actieve evaluaties.</p>
        )}
      </section>

      {/* Project Assessments This Week */}
      <section className="bg-white border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">📊 Projectbeoordelingen deze week</h2>
          <Link
            href="/teacher/project-assessments"
            className="text-sm text-blue-600 hover:underline"
          >
            Bekijk alle →
          </Link>
        </div>
        {recentProjects.length > 0 ? (
          <div className="space-y-3">
            {recentProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="font-medium">{project.title}</div>
                  <div className="text-sm text-gray-600">
                    {project.group_name || "—"} • {project.course_name || "—"}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Scores: {project.scores_count} / {project.total_criteria}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      project.status === "published"
                        ? "bg-green-50 text-green-700"
                        : "bg-yellow-50 text-yellow-700"
                    }`}
                  >
                    {project.status}
                  </span>
                  <Link
                    href={`/teacher/project-assessments/${project.id}/overview`}
                    className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-100"
                  >
                    Bekijk
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            Geen recente projectbeoordelingen deze week.
          </p>
        )}
      </section>

      {/* Competency Monitor Status */}
      <section className="bg-white border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">🎯 Competentiemonitor status</h2>
          <Link
            href="/teacher/competencies"
            className="text-sm text-blue-600 hover:underline"
          >
            Bekijk alle →
          </Link>
        </div>
        {competencyWindows.length > 0 ? (
          <div className="space-y-3">
            {competencyWindows.slice(0, 5).map((window) => (
              <div
                key={window.id}
                className="p-4 border rounded-xl hover:bg-gray-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{window.title}</div>
                  <Link
                    href={`/teacher/competencies/windows/${window.id}`}
                    className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-100"
                  >
                    Bekijk
                  </Link>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  {formatDate(window.start_date)} - {formatDate(window.end_date)}
                </div>
                <div className="text-xs text-gray-500">
                  Status: {window.status || "active"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Geen actieve competentievensters.</p>
        )}
      </section>


    </main>
  );
}
