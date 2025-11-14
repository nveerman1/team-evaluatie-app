"use client";

import { useState, useEffect } from "react";
import { Course } from "@/dtos/course.dto";
import CourseSelector from "@/components/CourseSelector";
import {
  analyticsService,
  CourseSummary,
  LearningObjectiveProgress,
  EvaluationTypeStats,
} from "@/services/analytics.service";

export default function AnalyticsPage() {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<CourseSummary | null>(null);
  const [loProgress, setLoProgress] = useState<LearningObjectiveProgress[]>([]);
  const [evalStats, setEvalStats] = useState<EvaluationTypeStats[]>([]);

  useEffect(() => {
    if (selectedCourse) {
      loadAnalytics();
    }
  }, [selectedCourse]);

  const loadAnalytics = async () => {
    if (!selectedCourse) return;

    setLoading(true);
    setError(null);
    try {
      // Load all analytics data in parallel
      const [summaryData, loData, evalStatsData] = await Promise.all([
        analyticsService.getCourseSummary(selectedCourse.id),
        analyticsService.getLearningObjectivesProgress(selectedCourse.id),
        analyticsService.getEvaluationTypeStats(selectedCourse.id),
      ]);

      setAnalytics(summaryData);
      setLoProgress(loData);
      setEvalStats(evalStatsData);
    } catch (err: any) {
      console.error("Failed to load analytics:", err);
      const errorMsg = err?.response?.data?.detail || err?.message || "Kon analytics niet laden";
      setError(errorMsg);
      // Reset data on error
      setAnalytics(null);
      setLoProgress([]);
      setEvalStats([]);
    } finally {
      setLoading(false);
    }
  };

  const getColorForScore = (score: number) => {
    if (score >= 8) return "text-green-600 bg-green-50";
    if (score >= 6.5) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return "bg-green-500";
    if (percentage >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Analytics Dashboard
          </h1>
          <p className="mt-1 text-gray-600">
            Bekijk voortgang en resultaten per vak
          </p>
        </div>

        {/* Course selector */}
        <div className="mb-6">
          <CourseSelector
            selectedCourseId={selectedCourse?.id}
            onCourseChange={setSelectedCourse}
          />
        </div>

        {!selectedCourse ? (
          <div className="rounded-lg bg-yellow-50 p-6 text-center">
            <p className="text-lg font-medium text-yellow-900">
              Selecteer een vak
            </p>
            <p className="mt-1 text-yellow-700">
              Kies eerst een vak om de analytics te bekijken
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Analytics kunnen niet worden geladen
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={loadAnalytics}
                    className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
                  >
                    Opnieuw proberen
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
            {analytics && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-white p-6 shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Studenten
                      </p>
                      <p className="mt-2 text-3xl font-bold text-gray-900">
                        {analytics.total_students}
                      </p>
                    </div>
                    <div className="rounded-full bg-blue-100 p-3">
                      <svg
                        className="h-6 w-6 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Evaluaties
                      </p>
                      <p className="mt-2 text-3xl font-bold text-gray-900">
                        {analytics.completed_evaluations}/{analytics.total_evaluations}
                      </p>
                    </div>
                    <div className="rounded-full bg-purple-100 p-3">
                      <svg
                        className="h-6 w-6 text-purple-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Gemiddeld cijfer
                      </p>
                      <p
                        className={`mt-2 text-3xl font-bold ${
                          analytics.average_score >= 7.5
                            ? "text-green-600"
                            : analytics.average_score >= 6
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {analytics.average_score.toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-full bg-green-100 p-3">
                      <svg
                        className="h-6 w-6 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Participatie
                      </p>
                      <p className="mt-2 text-3xl font-bold text-gray-900">
                        {analytics.participation_rate}%
                      </p>
                    </div>
                    <div className="rounded-full bg-yellow-100 p-3">
                      <svg
                        className="h-6 w-6 text-yellow-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Learning Objectives Progress */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                Leerdoelen voortgang
              </h2>
              <p className="mb-4 text-sm text-gray-600">
                Overzicht van alle leerdoelen met coverage en gemiddelde scores
              </p>
              <div className="space-y-4">
                {loProgress.map((lo) => (
                  <div
                    key={lo.id}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                            {lo.code}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {lo.description}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {lo.student_count} studenten
                        </p>
                      </div>
                      <div className="ml-4 text-right">
                        <div
                          className={`rounded px-2 py-1 text-sm font-semibold ${getColorForScore(
                            lo.average_score
                          )}`}
                        >
                          ⌀ {lo.average_score.toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>Coverage</span>
                        <span className="font-medium">{lo.coverage}%</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                        <div
                          className={`h-full rounded-full ${getProgressColor(
                            lo.coverage
                          )}`}
                          style={{ width: `${lo.coverage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Evaluation Type Statistics */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                Evaluatie types
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                {evalStats.map((stat) => (
                  <div
                    key={stat.type}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-medium capitalize text-gray-900">
                        {stat.type === "peer"
                          ? "Peer evaluatie"
                          : stat.type === "project"
                          ? "Project"
                          : "Competentie"}
                      </h3>
                      <span className="rounded bg-gray-100 px-2 py-1 text-sm font-medium text-gray-700">
                        {stat.count}x
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Gem. cijfer:</span>
                        <span
                          className={`font-semibold ${
                            stat.avg_score >= 7.5
                              ? "text-green-600"
                              : stat.avg_score >= 6
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        >
                          {stat.avg_score.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Compleet:</span>
                        <span className="font-semibold text-gray-900">
                          {stat.completion_rate}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Export section */}
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-6 text-center">
              <h3 className="text-lg font-medium text-gray-900">
                Exporteer analytics
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                Download complete analytics rapport als Excel of PDF
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  📊 Excel
                </button>
                <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  📄 PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
