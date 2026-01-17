"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback, Fragment } from "react";
import Link from "next/link";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { externalAssessmentService } from "@/services/external-assessment.service";
import type {
  ExternalAssessmentStatus,
  ExternalAdvisoryDetail,
} from "@/dtos/external-assessment.dto";
import { ProjectAssessmentTeamOverview } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { ChevronDown, ChevronRight } from "lucide-react";

type ExternalTeamStatus = ExternalAssessmentStatus;

export default function ExternalAssessmentPageInner() {
  const params = useParams();
  const assessmentId = Number(params?.assessmentId);

  // State for data loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessmentData, setAssessmentData] =
    useState<ProjectAssessmentTeamOverview | null>(null);
  const [externalStatuses, setExternalStatuses] = useState<
    ExternalTeamStatus[]
  >([]);

  // State for filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Track which teams are expanded
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  // Store loaded detail data for each team
  const [teamDetailsCache, setTeamDetailsCache] = useState<
    Map<string, ExternalAdvisoryDetail>
  >(new Map());
  const [loadingTeams, setLoadingTeams] = useState<Set<string>>(new Set());
  const [teamLoadErrors, setTeamLoadErrors] = useState<Map<string, string>>(
    new Map()
  );

  // Toggle team expansion and load data if needed
  const toggleTeamExpansion = async (
    teamId: number,
    teamNumber: number | undefined
  ) => {
    const key = `${teamId}-${teamNumber ?? 'no-number'}`;
    const isCurrentlyExpanded = expandedTeams.has(key);
    const willBeExpanded = !isCurrentlyExpanded;

    setExpandedTeams((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });

    // Load detail data if not already cached and we're expanding
    if (willBeExpanded && !teamDetailsCache.has(key)) {
      setLoadingTeams((prev) => new Set(prev).add(key));
      // Clear any previous error for this team
      setTeamLoadErrors((prev) => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
      try {
        const detail =
          await externalAssessmentService.getExternalAdvisoryDetail(
            teamId,
            teamNumber ?? undefined
          );
        setTeamDetailsCache((prev) => new Map(prev).set(key, detail));
      } catch (e: unknown) {
        console.error("Could not load team details:", e);
        const errorMessage =
          e instanceof ApiAuthError
            ? e.originalMessage
            : "Kon advies niet laden. Probeer het opnieuw.";
        setTeamLoadErrors((prev) => new Map(prev).set(key, errorMessage));
      } finally {
        setLoadingTeams((prev) => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }
    }
  };

  // Load initial data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // First get assessment overview to get project_id
      const overview =
        await projectAssessmentService.getTeamOverview(assessmentId);
      setAssessmentData(overview);

      // Get external status if assessment has a project_id
      if (overview.assessment.project_id) {
        try {
          const statuses =
            await externalAssessmentService.getProjectExternalStatus(
              overview.assessment.project_id,
              assessmentId  // Pass assessment_id to filter by this assessment
            );
          setExternalStatuses(statuses);
        } catch (statusErr) {
          // If we can't get external status, show empty state
          console.warn("Could not fetch external status:", statusErr);
          setExternalStatuses([]);
        }
      } else {
        // No project_id means no external assessments can be configured
        setExternalStatuses([]);
      }
    } catch (e: unknown) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        const err = e as {
          response?: { data?: { detail?: string } };
          message?: string;
        };
        setError(
          err?.response?.data?.detail || err?.message || "Laden mislukt"
        );
      }
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format date
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "NOT_INVITED":
        return (
          <span className="px-3 py-1 rounded-full border text-xs font-medium bg-gray-100 text-gray-600">
            Geen uitnodiging
          </span>
        );
      case "INVITED":
        return (
          <span className="px-3 py-1 rounded-full border text-xs font-medium bg-blue-100 text-blue-800">
            Uitgenodigd
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="px-3 py-1 rounded-full border text-xs font-medium bg-orange-100 text-orange-800">
            Bezig
          </span>
        );
      case "SUBMITTED":
        return (
          <span className="px-3 py-1 rounded-full border text-xs font-medium bg-green-100 text-green-800">
            Ingeleverd
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full border text-xs font-medium bg-gray-100 text-gray-600">
            {status}
          </span>
        );
    }
  };

  // Get evaluator display name
  const getEvaluatorDisplay = (team: ExternalTeamStatus) => {
    if (!team.external_evaluator) return "—";
    const { name, organisation, email } = team.external_evaluator;
    if (name && organisation) return `${name} (${organisation})`;
    if (name) return name;
    return email;
  };

  // Filter external statuses
  let filteredStatuses = externalStatuses;
  
  // Apply status filter
  if (statusFilter !== "all") {
    filteredStatuses = filteredStatuses.filter((s) => {
      if (statusFilter === "submitted") return s.status === "SUBMITTED";
      if (statusFilter === "pending") return s.status === "INVITED" || s.status === "IN_PROGRESS";
      if (statusFilter === "not_invited") return s.status === "NOT_INVITED";
      return true;
    });
  }
  
  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredStatuses = filteredStatuses.filter((s) => {
      const teamMatch = s.team_name?.toLowerCase().includes(query);
      const membersMatch = s.members?.toLowerCase().includes(query);
      const evaluatorMatch = getEvaluatorDisplay(s).toLowerCase().includes(query);
      return teamMatch || membersMatch || evaluatorMatch;
    });
  }

  if (loading) return <Loading />;
  if (error && !assessmentData) return <ErrorMessage message={error} />;
  if (!assessmentData) return <ErrorMessage message="Geen data gevonden" />;

  return (
    <>
      {/* Search and Filters - styled like OMZA */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            className="h-9 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Zoek op team, lid of externe beoordelaar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Alle</option>
            <option value="submitted">✅ Ingeleverd</option>
            <option value="pending">⏳ Wachtend</option>
            <option value="not_invited">⬜ Geen uitnodiging</option>
          </select>
        </div>
      </div>

      {/* Empty State */}
      {externalStatuses.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-gray-500 mb-4">
            Er zijn nog geen externe beoordelingen gekoppeld.
          </div>
          <p className="text-sm text-gray-400">
            Stel deze in via de tab{" "}
            <Link
              href={`/teacher/project-assessments/${assessmentId}/settings`}
              className="text-blue-600 hover:underline"
            >
              Bewerken
            </Link>
            .
          </p>
        </div>
      )}

      {/* Teams Table - styled like OMZA */}
      {filteredStatuses.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide sticky left-0 bg-gray-50">
                    Team
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide min-w-[200px]">
                    Leden
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                    Externe beoordelaar
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                    Status extern
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                    Laatste update
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 tracking-wide">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStatuses.map((team, index) => {
                  const key = `${team.team_id}-${team.team_number ?? 'no-number'}`;
                  const isExpanded = expandedTeams.has(key);
                  const detailData = teamDetailsCache.get(key);
                  const isLoading = loadingTeams.has(key);
                  const loadError = teamLoadErrors.get(key);

                  return (
                    <Fragment key={key}>
                      {/* Team row */}
                      <tr className="bg-white hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium sticky left-0 bg-white">
                          {team.team_name}
                        </td>
                        <td className="px-5 py-3">
                          <div className="text-sm text-gray-600">
                            {team.members || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">
                            {getEvaluatorDisplay(team)}
                          </div>
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(team.status)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(team.updated_at || team.submitted_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {team.status === "SUBMITTED" && (
                            <button
                              onClick={() =>
                                toggleTeamExpansion(team.team_id, team.team_number)
                              }
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
                                  Bekijk advies
                                </>
                              )}
                            </button>
                          )}
                          {(team.status === "INVITED" ||
                            team.status === "IN_PROGRESS") && (
                            <button
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm"
                              title="Herinnering sturen (nog niet geïmplementeerd)"
                            >
                              Herinnering
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={6}
                            className="bg-gray-50 px-6 py-4"
                          >
                            {isLoading && (
                              <div className="py-8">
                                <Loading />
                              </div>
                            )}

                            {!isLoading && loadError && (
                              <div className="text-red-600 bg-red-50 p-4 rounded-lg">
                                {loadError}
                              </div>
                            )}

                            {!isLoading && !loadError && !detailData && (
                              <div className="text-red-600 bg-red-50 p-4 rounded-lg">
                                Kon advies niet laden
                              </div>
                            )}

                            {!isLoading && !loadError && detailData && (
                              <div className="space-y-4">
                                {/* Evaluator Info */}
                                <div className="bg-white rounded-lg border border-gray-200 p-4">
                                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                                    Externe beoordelaar
                                  </h3>
                                  <div className="text-gray-900">
                                    {detailData.external_evaluator.name}
                                  </div>
                                  {detailData.external_evaluator.organisation && (
                                    <div className="text-sm text-gray-600">
                                      {detailData.external_evaluator.organisation}
                                    </div>
                                  )}
                                  <div className="text-sm text-gray-500">
                                    {detailData.external_evaluator.email}
                                  </div>
                                  {detailData.submitted_at && (
                                    <div className="text-xs text-gray-400 mt-2">
                                      Ingeleverd: {formatDate(detailData.submitted_at)}
                                    </div>
                                  )}
                                </div>

                                {/* Rubric Info */}
                                <div className="bg-white rounded-lg border border-gray-200 p-4">
                                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                                    Rubric: {detailData.rubric_title}
                                  </h3>
                                  <p className="text-xs text-gray-500">
                                    Schaal: {detailData.rubric_scale_min} -{" "}
                                    {detailData.rubric_scale_max}
                                  </p>
                                </div>

                                {/* Scores Table */}
                                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-white">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                          Criterium
                                        </th>
                                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                                          Score
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                          Opmerking
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                      {detailData.scores.map((score) => (
                                        <tr
                                          key={score.criterion_id}
                                          className="hover:bg-gray-50"
                                        >
                                          <td className="px-4 py-2 text-sm text-gray-900">
                                            <div className="font-medium">
                                              {score.criterion_name}
                                            </div>
                                            {score.category && (
                                              <div className="text-xs text-gray-500">
                                                {score.category}
                                              </div>
                                            )}
                                          </td>
                                          <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-center">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold">
                                              {score.score}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 text-sm text-gray-600">
                                            {score.comment || "—"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>

                                {/* General Comment */}
                                {detailData.general_comment && (
                                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                                      Algemeen advies
                                    </h3>
                                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                      {detailData.general_comment}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
