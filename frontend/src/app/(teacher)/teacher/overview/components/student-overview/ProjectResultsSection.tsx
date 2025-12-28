"use client";

import React, { useState, useEffect } from "react";
import { overviewService } from "@/services/overview.service";
import type { ProjectOverviewItem } from "@/dtos/overview.dto";

interface ProjectResultsSectionProps {
  studentId: number;
  courseId: number;
}

// Helper function for score color coding
function getScoreColor(score: number | null | undefined): string {
  if (!score) return "bg-slate-100 text-slate-400";
  if (score >= 8.0) return "bg-emerald-100 text-emerald-700";
  if (score >= 7.0) return "bg-green-100 text-green-700";
  if (score >= 6.0) return "bg-amber-100 text-amber-700";
  if (score >= 5.5) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

function formatScore(score: number | null | undefined): string {
  if (!score) return "-";
  return score.toFixed(1);
}

export function ProjectResultsSection({ studentId, courseId }: ProjectResultsSectionProps) {
  const [projects, setProjects] = useState<ProjectOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      try {
        setLoading(true);
        const response = await overviewService.getProjectOverview({
          courseId: String(courseId),
        });
        setProjects(response.projects);
      } catch (error) {
        console.error("Error fetching projects:", error);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, [courseId]); // studentId not needed - we show all projects in the course

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Projectresultaten</h3>
        <div className="animate-pulse space-y-2">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Projectresultaten</h3>
      
      {projects.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Geen projecten gevonden</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-[25%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Project
                </th>
                <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Periode
                </th>
                <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Client
                </th>
                <th className="w-[15%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Teams
                </th>
                <th className="w-[15%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Gemiddelde
                </th>
                <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {projects.map((project) => (
                <tr key={project.project_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="line-clamp-2">{project.project_name}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {project.period_label}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="line-clamp-1">{project.client_name || "-"}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-center">
                    {project.num_teams}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(
                        project.average_score_overall
                      )}`}
                    >
                      {formatScore(project.average_score_overall)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        project.status === "active"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {project.status === "active" ? "Actief" : "Voltooid"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
