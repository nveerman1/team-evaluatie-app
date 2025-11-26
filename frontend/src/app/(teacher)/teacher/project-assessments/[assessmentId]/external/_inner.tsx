"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
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

  // State for detail slide-over
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<ExternalAdvisoryDetail | null>(
    null
  );
  const [detailError, setDetailError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        // First get assessment overview to get project_id
        const overview =
          await projectAssessmentService.getTeamOverview(assessmentId);
        setAssessmentData(overview);

        // For now, we use a placeholder project_id. In a real implementation,
        // we would need to get the project_id from the assessment or group.
        // Let's try to get external status using the assessment's group_id first team
        // as the project context
        if (overview.teams.length > 0) {
          // Try to fetch external status using assessment's metadata or course info
          // For now, assume project_id might be in assessment metadata or we need to derive it
          try {
            // Use a reasonable project_id - in practice this should come from assessment metadata
            // For this demo, let's use the course_id or a derived value
            const projectId = overview.assessment.metadata_json?.project_id || 1;
            const statuses =
              await externalAssessmentService.getProjectExternalStatus(
                projectId
              );
            setExternalStatuses(statuses);
          } catch (statusErr) {
            // If we can't get external status, show empty state
            console.warn("Could not fetch external status:", statusErr);
            setExternalStatuses([]);
          }
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
    }
    loadData();
  }, [assessmentId]);

  // Load detail when team is selected
  useEffect(() => {
    async function loadDetail() {
      if (!selectedTeamId) {
        setDetailData(null);
        return;
      }

      setDetailLoading(true);
      setDetailError(null);
      try {
        const detail =
          await externalAssessmentService.getExternalAdvisoryDetail(
            selectedTeamId
          );
        setDetailData(detail);
      } catch (e: unknown) {
        if (e instanceof ApiAuthError) {
          setDetailError(e.originalMessage);
        } else {
          const err = e as {
            response?: { data?: { detail?: string } };
            message?: string;
          };
          setDetailError(
            err?.response?.data?.detail ||
              err?.message ||
              "Kon advies niet laden"
          );
        }
      } finally {
        setDetailLoading(false);
      }
    }
    loadDetail();
  }, [selectedTeamId]);

  // Compute KPIs
  const submittedCount = externalStatuses.filter(
    (s) => s.status === "SUBMITTED"
  ).length;
  const pendingCount = externalStatuses.filter(
    (s) => s.status === "INVITED" || s.status === "IN_PROGRESS"
  ).length;
  const notInvitedCount = externalStatuses.filter(
    (s) => s.status === "NOT_INVITED"
  ).length;
  const totalExternals = new Set(
    externalStatuses
      .filter((s) => s.external_evaluator)
      .map((s) => s.external_evaluator?.email)
  ).size;

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
          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
            Geen uitnodiging
          </span>
        );
      case "INVITED":
        return (
          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
            Uitgenodigd
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs">
            Bezig
          </span>
        );
      case "SUBMITTED":
        return (
          <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
            Ingeleverd
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
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

  if (loading) return <Loading />;
  if (error && !assessmentData) return <ErrorMessage message={error} />;
  if (!assessmentData) return <ErrorMessage message="Geen data gevonden" />;

  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-1">Teams met extern advies</div>
          <div className="text-2xl font-semibold text-green-600">
            {submittedCount}
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-1">Nog te beoordelen teams</div>
          <div className="text-2xl font-semibold text-yellow-600">
            {pendingCount}
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-1">Geen extern gekoppeld</div>
          <div className="text-2xl font-semibold text-gray-600">
            {notInvitedCount}
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-1">Aantal externen</div>
          <div className="text-2xl font-semibold text-blue-600">
            {totalExternals}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {externalStatuses.length === 0 && (
        <section className="bg-white border rounded-2xl p-8 text-center">
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
        </section>
      )}

      {/* Teams Table */}
      {externalStatuses.length > 0 && (
        <section className="bg-white border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Team
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Leden
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Opdrachtgever
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Status extern
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Laatste update
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody>
                {externalStatuses.map((team, index) => (
                  <tr
                    key={`team-${team.team_id}-${team.team_number ?? index}`}
                    className="border-b last:border-b-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{team.team_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600">
                        {team.members || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{getEvaluatorDisplay(team)}</div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(team.status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(team.updated_at || team.submitted_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {team.status === "SUBMITTED" && (
                        <button
                          onClick={() => setSelectedTeamId(team.team_id)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
                        >
                          Bekijk advies
                        </button>
                      )}
                      {(team.status === "INVITED" ||
                        team.status === "IN_PROGRESS") && (
                        <button
                          className="px-3 py-1.5 rounded-lg border text-gray-700 hover:bg-gray-100 text-sm"
                          title="Herinnering sturen (nog niet geïmplementeerd)"
                        >
                          Herinnering
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Slide-over Panel */}
      {selectedTeamId && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedTeamId(null)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Extern advies{" "}
                  {detailData ? `- ${detailData.team_name}` : ""}
                </h2>
                <button
                  onClick={() => setSelectedTeamId(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {detailLoading && <Loading />}

                {detailError && (
                  <div className="text-red-600 bg-red-50 p-4 rounded-lg">
                    {detailError}
                  </div>
                )}

                {detailData && !detailLoading && (
                  <div className="space-y-6">
                    {/* Evaluator Info */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Opdrachtgever
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
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Rubric: {detailData.rubric_title}
                      </h3>
                      <p className="text-xs text-gray-500">
                        Schaal: {detailData.rubric_scale_min} -{" "}
                        {detailData.rubric_scale_max}
                      </p>
                    </div>

                    {/* Scores Table */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">
                        Scores per criterium
                      </h3>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-600">
                                Criterium
                              </th>
                              <th className="px-3 py-2 text-center font-medium text-gray-600 w-16">
                                Score
                              </th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600">
                                Opmerking
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailData.scores.map((score, idx) => (
                              <tr
                                key={score.criterion_id}
                                className={
                                  idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                                }
                              >
                                <td className="px-3 py-2">
                                  <div className="font-medium">
                                    {score.criterion_name}
                                  </div>
                                  {score.category && (
                                    <div className="text-xs text-gray-500">
                                      {score.category}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold">
                                    {score.score}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-gray-600">
                                  {score.comment || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* General Comment */}
                    {detailData.general_comment && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">
                          Algemeen advies
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4 text-gray-700 whitespace-pre-wrap">
                          {detailData.general_comment}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
