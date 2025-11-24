"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { externalAssessmentService } from "@/services/external-assessment.service";
import type { ExternalAssessmentTokenInfo } from "@/dtos/external-assessment.dto";

export default function ExternalAssessmentOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<ExternalAssessmentTokenInfo | null>(
    null
  );

  useEffect(() => {
    loadTokenInfo();
  }, [token]);

  const loadTokenInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const info = await externalAssessmentService.resolveToken(token);
      setTokenInfo(info);

      // If only one team, redirect directly to assessment
      if (info.single_team && info.teams.length === 1) {
        router.push(`/external/assessment/${token}/team/${info.teams[0].team_id}`);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "Ongeldige of verlopen uitnodiging. Neem contact op met degene die u deze link heeft gestuurd."
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
            Ingeleverd
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
            Concept
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">
            Nog niet gestart
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Laden...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
            Fout bij laden
          </h2>
          <p className="text-gray-600 text-center">{error}</p>
        </div>
      </div>
    );
  }

  if (!tokenInfo) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Externe Beoordeling
          </h1>
          <div className="text-sm text-gray-600 space-y-1">
            {tokenInfo.project_name && (
              <p>
                <span className="font-medium">Project:</span>{" "}
                {tokenInfo.project_name}
              </p>
            )}
            {tokenInfo.class_name && (
              <p>
                <span className="font-medium">Klas:</span>{" "}
                {tokenInfo.class_name}
              </p>
            )}
            <p>
              <span className="font-medium">Beoordelaar:</span>{" "}
              {tokenInfo.external_evaluator.name}
              {tokenInfo.external_evaluator.organisation &&
                ` (${tokenInfo.external_evaluator.organisation})`}
            </p>
          </div>
        </div>

        {/* Intro */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                Je beoordeelt de projectteams met deze rubric. Deze beoordeling
                wordt gebruikt als advies voor de docent.
              </p>
            </div>
          </div>
        </div>

        {/* Teams List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Teams</h2>
          {tokenInfo.teams.map((team) => (
            <div
              key={team.team_id}
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {team.team_name}
                    </h3>
                    {team.project_title && (
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Project:</span>{" "}
                        {team.project_title}
                      </p>
                    )}
                    {team.description && (
                      <p className="text-sm text-gray-600 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {team.description}
                      </p>
                    )}
                  </div>
                  <div className="ml-4">{getStatusBadge(team.status)}</div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() =>
                      router.push(
                        `/external/assessment/${token}/team/${team.team_id}`
                      )
                    }
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Beoordeel dit team
                    <svg
                      className="ml-2 -mr-1 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
