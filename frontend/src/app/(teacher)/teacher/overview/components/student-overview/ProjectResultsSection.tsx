"use client";

import React, { useState, useEffect } from "react";
import { overviewService } from "@/services/overview.service";
import type { ProjectOverviewItem, ProjectTeamScore } from "@/dtos/overview.dto";

interface ProjectResultsSectionProps {
  studentId: number;
  studentName: string;
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

interface StudentProjectResult {
  project_id: number;
  project_name: string;
  period_label: string;
  client_name: string | null;
  team_number: number;
  team_name: string | null;
  team_members: string[];
  projectproces: number | null;
  eindresultaat: number | null;
  communicatie: number | null;
  overall_score: number | null;
}

export function ProjectResultsSection({ studentId, studentName, courseId }: ProjectResultsSectionProps) {
  const [studentResults, setStudentResults] = useState<StudentProjectResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStudentProjects() {
      try {
        setLoading(true);
        
        // First, get all projects for the course
        const projectsResponse = await overviewService.getProjectOverview({
          courseId: String(courseId),
        });
        
        // Then for each project, get team details to find student
        const results: StudentProjectResult[] = [];
        
        for (const project of projectsResponse.projects) {
          try {
            const teamsResponse = await overviewService.getProjectTeams(project.project_id);
            
            // Find the team that contains this student by name
            const studentTeam = teamsResponse.teams.find(team => 
              team.team_members.some(member => 
                member.toLowerCase().includes(studentName.toLowerCase()) ||
                studentName.toLowerCase().includes(member.toLowerCase())
              )
            );
            
            if (studentTeam) {
              results.push({
                project_id: project.project_id,
                project_name: project.project_name,
                period_label: project.period_label,
                client_name: project.client_name ?? null,
                team_number: studentTeam.team_number,
                team_name: studentTeam.team_name ?? null,
                team_members: studentTeam.team_members,
                projectproces: studentTeam.category_scores.projectproces ?? null,
                eindresultaat: studentTeam.category_scores.eindresultaat ?? null,
                communicatie: studentTeam.category_scores.communicatie ?? null,
                overall_score: studentTeam.overall_score ?? null,
              });
            }
          } catch (error) {
            console.error(`Error fetching teams for project ${project.project_id}:`, error);
          }
        }
        
        setStudentResults(results);
      } catch (error) {
        console.error("Error fetching student projects:", error);
        setStudentResults([]);
      } finally {
        setLoading(false);
      }
    }
    fetchStudentProjects();
  }, [studentId, studentName, courseId]);

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
      
      {studentResults.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Geen projectresultaten gevonden</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Project
                </th>
                <th className="w-[8%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Periode
                </th>
                <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Opdrachtgever
                </th>
                <th className="w-[6%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Team
                </th>
                <th className="w-[18%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Teamleden
                </th>
                <th className="w-[9%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Projectproces
                </th>
                <th className="w-[9%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Eindresultaat
                </th>
                <th className="w-[9%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Communicatie
                </th>
                <th className="w-[9%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Gem. score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {studentResults.map((result) => (
                <tr key={result.project_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="line-clamp-2">{result.project_name}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {result.period_label}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="line-clamp-2">{result.client_name || "-"}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-center">
                    {result.team_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="line-clamp-2" title={result.team_members.join(", ")}>
                      {result.team_members.join(", ")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(
                        result.projectproces
                      )}`}
                    >
                      {formatScore(result.projectproces)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(
                        result.eindresultaat
                      )}`}
                    >
                      {formatScore(result.eindresultaat)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(
                        result.communicatie
                      )}`}
                    >
                      {formatScore(result.communicatie)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(
                        result.overall_score
                      )}`}
                    >
                      {formatScore(result.overall_score)}
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
