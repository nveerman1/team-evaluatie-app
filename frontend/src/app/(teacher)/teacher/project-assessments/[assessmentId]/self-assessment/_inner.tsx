"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentSelfOverview } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProjectAssessmentSelfInner() {
  const params = useParams();
  const assessmentId = Number(params?.assessmentId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProjectAssessmentSelfOverview | null>(null);
  
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("team");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
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
          sortDirection
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
  }, [assessmentId, searchQuery, sortBy, sortDirection]);

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

  return (
    <div className="space-y-6">
      {/* Statistics card - matching Overview/Scores style */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Overzicht
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-gray-600">Totaal studenten</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {data.statistics.total_students}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Ingevuld</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {data.statistics.completed_assessments}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Gemiddeld cijfer</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">
              {data.statistics.average_grade
                ? data.statistics.average_grade.toFixed(1)
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Sort controls - matching Overview/Scores style */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Zoek op naam of team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 rounded-lg bg-white pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sorteer op:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">Teamnummer</SelectItem>
                <SelectItem value="name">Naam</SelectItem>
                <SelectItem value="grade">Eindcijfer</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortDirection} onValueChange={(v: any) => setSortDirection(v)}>
              <SelectTrigger className="w-[110px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Oplopend</SelectItem>
                <SelectItem value="desc">Aflopend</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Teams table - matching Scores table style */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Team
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Teamleden
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Ingevuld
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Gem. score
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Eindcijfer
                </th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {data.team_overviews.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-sm text-gray-500"
                  >
                    Geen teams gevonden
                  </td>
                </tr>
              ) : (
                data.team_overviews.map((team) => {
                  const isExpanded = expandedTeams.has(team.team_number);
                  return (
                    <>
                      {/* Team row */}
                      <tr
                        key={team.team_number}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          {team.team_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div className="flex flex-col gap-0.5">
                            {team.members.slice(0, 2).map((member) => (
                              <span key={member.id}>{member.name}</span>
                            ))}
                            {team.members.length > 2 && (
                              <span className="text-xs text-gray-400">
                                +{team.members.length - 2} meer
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-sm">
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
                        <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                          {team.avg_total_score
                            ? team.avg_total_score.toFixed(1)
                            : "—"}
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-semibold text-blue-600">
                          {team.avg_grade ? team.avg_grade.toFixed(1) : "—"}
                        </td>
                        <td className="px-6 py-4 text-right">
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
                          <td colSpan={6} className="bg-gray-50 px-6 py-4">
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
                    </>
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
