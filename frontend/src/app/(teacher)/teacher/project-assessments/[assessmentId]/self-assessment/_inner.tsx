"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentSelfOverview } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function ProjectAssessmentSelfInner() {
  const params = useParams();
  const assessmentId = Number(params?.assessmentId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProjectAssessmentSelfOverview | null>(null);
  
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("team");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  // Track which teams are expanded
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await projectAssessmentService.getSelfAssessmentOverview(
          assessmentId,
          searchQuery,
          sortBy,
          sortOrder
        );
        setData(result);
      } catch (e: any) {
        if (e instanceof ApiAuthError) {
          setError(e.originalMessage);
        } else {
          setError(
            e?.response?.data?.detail || e?.message || "Laden mislukt"
          );
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [assessmentId, searchQuery, sortBy, sortOrder]);

  const toggleTeamExpansion = (teamNumber: number) => {
    setExpandedTeams((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(teamNumber)) {
        newSet.delete(teamNumber);
      } else {
        newSet.add(teamNumber);
      }
      return newSet;
    });
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Geen data gevonden" />;

  // Group criteria by category
  const groupedCriteria: Record<string, typeof data.criteria> = {};
  const categories: string[] = [];
  
  data.criteria.forEach((c) => {
    const cat = c.category || "Overig";
    if (!groupedCriteria[cat]) {
      groupedCriteria[cat] = [];
      categories.push(cat);
    }
    groupedCriteria[cat].push(c);
  });

  // Calculate average scores per category for each team
  const getTeamCategoryAverages = (team: typeof data.team_overviews[0]) => {
    const categoryAverages: Record<string, number> = {};
    
    categories.forEach((category) => {
      const categoryCriteria = groupedCriteria[category];
      const scores = categoryCriteria
        .map((criterion) => {
          const criterionScore = team.avg_criterion_scores.find(
            (cs) => cs.criterion_id === criterion.id
          );
          return criterionScore?.score;
        })
        .filter((score): score is number => score !== null && score !== undefined);
      
      if (scores.length > 0) {
        categoryAverages[category] = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      }
    });
    
    return categoryAverages;
  };

  return (
    <div className="space-y-6">
      {/* Search and Sort controls - matching scores page style */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            className="h-9 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Zoek op teamnaam of leerling..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="team">Teamnummer</option>
            <option value="name">Naam</option>
            <option value="grade">Eindcijfer</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm shadow-sm hover:bg-slate-50"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Teams table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 w-20">
                  Team
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Teamleden
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Ingevuld
                </th>
                {categories.map((category) => (
                  <th key={category} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                    {category}
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Eindcijfer
                </th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {data.team_overviews.length === 0 ? (
                <tr>
                  <td
                    colSpan={5 + categories.length}
                    className="px-6 py-8 text-center text-sm text-gray-500"
                  >
                    Geen teams gevonden
                  </td>
                </tr>
              ) : (
                data.team_overviews.map((team) => {
                  const isExpanded = expandedTeams.has(team.team_number);
                  const categoryAverages = getTeamCategoryAverages(team);
                  
                  return (
                    <React.Fragment key={team.team_number}>
                      {/* Team row */}
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-4 text-sm font-semibold text-gray-900">
                          Team {team.team_number}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            {team.members.map((member, index) => (
                              <span key={member.id}>
                                {member.name}
                                {index < team.members.length - 1 && ","}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-center text-sm">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              team.completed_count === team.members.length
                                ? "bg-emerald-100 text-emerald-700"
                                : team.completed_count > 0
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {team.completed_count} / {team.members.length}
                          </span>
                        </td>
                        {categories.map((category) => (
                          <td key={category} className="px-3 py-4 text-center text-sm font-medium text-gray-900">
                            {categoryAverages[category]
                              ? categoryAverages[category].toFixed(1)
                              : "—"}
                          </td>
                        ))}
                        <td className="px-3 py-4 text-center text-sm font-semibold text-blue-600">
                          {team.avg_grade ? team.avg_grade.toFixed(1) : "—"}
                        </td>
                        <td className="px-3 py-4 text-right">
                          <button
                            onClick={() => toggleTeamExpansion(team.team_number)}
                            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronDown className="mr-1 h-4 w-4" />
                                Verberg
                              </>
                            ) : (
                              <>
                                <ChevronRight className="mr-1 h-4 w-4" />
                                Bekijk
                              </>
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded student details */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={5 + categories.length} className="bg-gray-50 px-6 py-4">
                            <div className="space-y-3">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Individuele zelfbeoordelingen
                              </h4>
                              {team.student_details.map((student) => (
                                <div
                                  key={student.student_id}
                                  className="rounded-lg border border-gray-200 bg-white p-4"
                                >
                                  <div className="mb-2 flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">
                                        {student.student_name}
                                      </p>
                                      {student.updated_at && (
                                        <p className="text-xs text-gray-500">
                                          Laatst bijgewerkt:{" "}
                                          {new Date(
                                            student.updated_at
                                          ).toLocaleDateString("nl-NL")}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      {student.has_self_assessment ? (
                                        <>
                                          <p className="text-sm font-medium text-gray-700">
                                            Score:{" "}
                                            {student.total_score?.toFixed(1) ||
                                              "—"}
                                          </p>
                                          <p className="text-sm font-semibold text-blue-600">
                                            Cijfer:{" "}
                                            {student.grade?.toFixed(1) || "—"}
                                          </p>
                                        </>
                                      ) : (
                                        <span className="text-xs text-gray-400">
                                          Niet ingevuld
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Criteria scores */}
                                  {student.has_self_assessment && (
                                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                      {student.criterion_scores.map(
                                        (criterionScore) => (
                                          <div
                                            key={criterionScore.criterion_id}
                                            className="rounded border border-gray-100 bg-gray-50 p-2"
                                          >
                                            <p className="text-xs font-medium text-gray-600">
                                              {criterionScore.criterion_name}
                                            </p>
                                            <p className="text-sm font-semibold text-gray-900">
                                              {criterionScore.score ?? "—"}
                                            </p>
                                            {criterionScore.comment && (
                                              <p className="mt-1 text-xs text-gray-500">
                                                {criterionScore.comment}
                                              </p>
                                            )}
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
