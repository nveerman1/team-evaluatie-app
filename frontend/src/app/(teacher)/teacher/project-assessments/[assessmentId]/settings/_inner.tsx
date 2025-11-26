"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService, rubricService } from "@/services";
import { externalAssessmentService } from "@/services/external-assessment.service";
import { ProjectAssessmentTeamOverview } from "@/dtos";
import type { BulkInviteRequest, TeamIdentifier } from "@/dtos/external-assessment.dto";
import { Loading, ErrorMessage } from "@/components";

type ExternalMode = "none" | "all_teams" | "per_team";

type PerTeamConfig = {
  group_id: number;
  team_number: number;
  team_name: string;
  members: string[];
  evaluator_name: string;
  evaluator_email: string;
  evaluator_organisation: string;
  status: "NOT_INVITED" | "INVITED" | "IN_PROGRESS" | "SUBMITTED" | "";
};

type RubricOption = {
  id: number;
  title: string;
};

export default function SettingsPageInner() {
  const params = useParams();
  const assessmentId = Number(params?.assessmentId);

  // State for data loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProjectAssessmentTeamOverview | null>(null);
  const [rubrics, setRubrics] = useState<RubricOption[]>([]);

  // State for external assessment configuration
  const [externalEnabled, setExternalEnabled] = useState(false);
  const [externalMode, setExternalMode] = useState<ExternalMode>("none");

  // State for "All Teams" mode
  const [allTeamsConfig, setAllTeamsConfig] = useState({
    evaluator_name: "",
    evaluator_email: "",
    evaluator_organisation: "",
    rubric_id: 0,
    selected_teams: [] as TeamIdentifier[],
  });

  // State for "Per Team" mode
  const [perTeamConfigs, setPerTeamConfigs] = useState<PerTeamConfig[]>([]);

  // State for form submission
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [teamOverview, rubricList] = await Promise.all([
          projectAssessmentService.getTeamOverview(assessmentId),
          rubricService.getRubrics(undefined, "project"),
        ]);
        
        setData(teamOverview);
        setRubrics(rubricList.items?.map((r: any) => ({ id: r.id, title: r.title })) || []);

        // Initialize per-team configs from team data
        const initialPerTeamConfigs: PerTeamConfig[] = teamOverview.teams.map((team) => ({
          group_id: team.group_id,
          team_number: team.team_number || 0,
          team_name: team.group_name || `Team ${team.team_number}`,
          members: team.members.map((m) => m.name),
          evaluator_name: "",
          evaluator_email: "",
          evaluator_organisation: "",
          status: "",
        }));
        setPerTeamConfigs(initialPerTeamConfigs);

        // Initialize all-teams selected teams (all checked by default)
        setAllTeamsConfig((prev) => ({
          ...prev,
          selected_teams: teamOverview.teams.map((t) => ({
            group_id: t.group_id,
            team_number: t.team_number || 0,
          })),
        }));
      } catch (e: unknown) {
        if (e instanceof ApiAuthError) {
          setError(e.originalMessage);
        } else {
          const err = e as { response?: { data?: { detail?: string } }; message?: string };
          setError(err?.response?.data?.detail || err?.message || "Laden mislukt");
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [assessmentId]);

  // Handle enabling/disabling external assessment
  const handleExternalToggle = (enabled: boolean) => {
    setExternalEnabled(enabled);
    if (!enabled) {
      setExternalMode("none");
    }
  };

  // Handle "All Teams" checkbox toggle
  const handleSelectAllTeams = (checked: boolean) => {
    if (!data) return;
    setAllTeamsConfig((prev) => ({
      ...prev,
      selected_teams: checked
        ? data.teams.map((t) => ({ group_id: t.group_id, team_number: t.team_number || 0 }))
        : [],
    }));
  };

  // Handle individual team checkbox in "All Teams" mode
  const handleTeamToggle = (groupId: number, teamNumber: number, checked: boolean) => {
    setAllTeamsConfig((prev) => ({
      ...prev,
      selected_teams: checked
        ? [...prev.selected_teams, { group_id: groupId, team_number: teamNumber }]
        : prev.selected_teams.filter(
            (t) => !(t.group_id === groupId && t.team_number === teamNumber)
          ),
    }));
  };

  // Check if a team is selected in All Teams mode
  const isTeamSelected = (groupId: number, teamNumber: number) => {
    return allTeamsConfig.selected_teams.some(
      (t) => t.group_id === groupId && t.team_number === teamNumber
    );
  };

  // Handle updating per-team config
  const updatePerTeamConfig = (
    index: number,
    field: keyof PerTeamConfig,
    value: string
  ) => {
    setPerTeamConfigs((prev) => {
      const newConfigs = [...prev];
      newConfigs[index] = { ...newConfigs[index], [field]: value };
      return newConfigs;
    });
  };

  // Send invitation for "All Teams" mode
  const handleSendAllTeamsInvitation = async () => {
    if (!allTeamsConfig.evaluator_name || !allTeamsConfig.evaluator_email) {
      setSubmitError("Vul de naam en e-mail van de opdrachtgever in.");
      return;
    }
    if (allTeamsConfig.selected_teams.length === 0) {
      setSubmitError("Selecteer ten minste één team.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const request: BulkInviteRequest = {
        mode: "ALL_TEAMS",
        all_teams_config: {
          evaluator_name: allTeamsConfig.evaluator_name,
          evaluator_email: allTeamsConfig.evaluator_email,
          evaluator_organisation: allTeamsConfig.evaluator_organisation || undefined,
          teams: allTeamsConfig.selected_teams,
          rubric_id: allTeamsConfig.rubric_id || undefined,
        },
      };

      await externalAssessmentService.createBulkInvitations(request);
      setSuccessMessage(
        `Uitnodiging verstuurd naar ${allTeamsConfig.evaluator_name} voor ${allTeamsConfig.selected_teams.length} team(s).`
      );
    } catch (e: any) {
      console.error("Failed to send invitation:", e);
      setSubmitError(
        e?.response?.data?.detail ||
          "Kon uitnodiging niet versturen. Probeer het opnieuw."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Send invitation for a single team in "Per Team" mode
  const handleSendPerTeamInvitation = async (index: number) => {
    const config = perTeamConfigs[index];
    if (!config.evaluator_name || !config.evaluator_email) {
      setSubmitError(
        `Vul de naam en e-mail van de opdrachtgever in voor ${config.team_name}.`
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const request: BulkInviteRequest = {
        mode: "PER_TEAM",
        per_team_configs: [
          {
            group_id: config.group_id,
            team_number: config.team_number,
            evaluator_name: config.evaluator_name,
            evaluator_email: config.evaluator_email,
            evaluator_organisation: config.evaluator_organisation || undefined,
          },
        ],
      };

      await externalAssessmentService.createBulkInvitations(request);
      
      // Update status to indicate invitation sent
      setPerTeamConfigs((prev) => {
        const newConfigs = [...prev];
        newConfigs[index] = { ...newConfigs[index], status: "INVITED" };
        return newConfigs;
      });
      
      setSuccessMessage(
        `Uitnodiging verstuurd naar ${config.evaluator_name} voor ${config.team_name}.`
      );
    } catch (e: any) {
      console.error("Failed to send invitation:", e);
      setSubmitError(
        e?.response?.data?.detail ||
          "Kon uitnodiging niet versturen. Probeer het opnieuw."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Geen data gevonden" />;

  const allTeamsSelected =
    data.teams.length > 0 &&
    allTeamsConfig.selected_teams.length === data.teams.length;

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800">
          ✅ {successMessage}
        </div>
      )}
      {submitError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
          ❌ {submitError}
        </div>
      )}

      {/* Card 1: Basis instellingen beoordeling */}
      <section className="bg-white border rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Basis instellingen beoordeling
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600">Titel</label>
            <p className="text-gray-900">{data.assessment.title}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Rubric</label>
            <p className="text-gray-900">{data.rubric_title}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Schaal</label>
            <p className="text-gray-900">
              {data.rubric_scale_min} - {data.rubric_scale_max}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">
              Aantal teams
            </label>
            <p className="text-gray-900">{data.teams.length}</p>
          </div>
        </div>
      </section>

      {/* Card 2: Externe beoordeling (advies) */}
      <section className="bg-white border rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Externe beoordeling (advies)
        </h2>
        <p className="text-gray-600 text-sm mb-6">
          Opdrachtgevers kunnen een adviesbeoordeling geven. Jij bepaalt het
          uiteindelijke cijfer.
        </p>

        {/* Enable/Disable Toggle */}
        <div className="flex items-center gap-3 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={externalEnabled}
              onChange={(e) => handleExternalToggle(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-900">
              Externe beoordeling inschakelen
            </span>
          </label>
        </div>

        {/* Mode Selector - only show when enabled */}
        {externalEnabled && (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Kies hoe externe beoordelaars worden toegewezen:
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="external_mode"
                    value="none"
                    checked={externalMode === "none"}
                    onChange={() => setExternalMode("none")}
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">Geen extern</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="external_mode"
                    value="all_teams"
                    checked={externalMode === "all_teams"}
                    onChange={() => setExternalMode("all_teams")}
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">
                    Eén opdrachtgever beoordeelt alle teams (onderbouw / regulier)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="external_mode"
                    value="per_team"
                    checked={externalMode === "per_team"}
                    onChange={() => setExternalMode("per_team")}
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">
                    Per team een eigen opdrachtgever (bovenbouw)
                  </span>
                </label>
              </div>
            </div>

            {/* All Teams Mode Configuration */}
            {externalMode === "all_teams" && (
              <div className="border-t pt-6 space-y-4">
                <h3 className="font-medium text-gray-900">
                  Opdrachtgever gegevens
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Opdrachtgever naam *
                    </label>
                    <input
                      type="text"
                      value={allTeamsConfig.evaluator_name}
                      onChange={(e) =>
                        setAllTeamsConfig((prev) => ({
                          ...prev,
                          evaluator_name: e.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Jan Jansen"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      E-mailadres *
                    </label>
                    <input
                      type="email"
                      value={allTeamsConfig.evaluator_email}
                      onChange={(e) =>
                        setAllTeamsConfig((prev) => ({
                          ...prev,
                          evaluator_email: e.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="jan@bedrijf.nl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Organisatie
                    </label>
                    <input
                      type="text"
                      value={allTeamsConfig.evaluator_organisation}
                      onChange={(e) =>
                        setAllTeamsConfig((prev) => ({
                          ...prev,
                          evaluator_organisation: e.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Bedrijf B.V."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Rubric voor externen
                  </label>
                  <select
                    value={allTeamsConfig.rubric_id}
                    onChange={(e) =>
                      setAllTeamsConfig((prev) => ({
                        ...prev,
                        rubric_id: Number(e.target.value),
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={0}>Standaard rubric gebruiken</option>
                    {rubrics.map((rubric) => (
                      <option key={rubric.id} value={rubric.id}>
                        {rubric.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Team Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Teams selecteren
                  </label>
                  <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer border-b pb-2 mb-2">
                      <input
                        type="checkbox"
                        checked={allTeamsSelected}
                        onChange={(e) => handleSelectAllTeams(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-900">
                        Alle teams selecteren
                      </span>
                    </label>
                    {data.teams.map((team, index) => (
                      <label
                        key={`team-${team.group_id}-${team.team_number}-${index}`}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isTeamSelected(
                            team.group_id,
                            team.team_number || 0
                          )}
                          onChange={(e) =>
                            handleTeamToggle(
                              team.group_id,
                              team.team_number || 0,
                              e.target.checked
                            )
                          }
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900">
                          {team.group_name || `Team ${team.team_number}`} –{" "}
                          {team.members.map((m) => m.name).join(", ")}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleSendAllTeamsInvitation}
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {submitting ? "Versturen..." : "Uitnodiging versturen"}
                  </button>
                </div>
              </div>
            )}

            {/* Per Team Mode Configuration */}
            {externalMode === "per_team" && (
              <div className="border-t pt-6">
                <h3 className="font-medium text-gray-900 mb-4">
                  Opdrachtgever per team
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                          Team
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                          Teamleden
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                          Opdrachtgever naam
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                          E-mail
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                          Organisatie
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                          Acties
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {perTeamConfigs.map((config, index) => (
                        <tr
                          key={`perteam-${config.group_id}-${config.team_number}-${index}`}
                          className="border-b last:border-b-0"
                        >
                          <td className="px-4 py-3">
                            <span className="font-medium">{config.team_name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-600">
                              {config.members.join(", ")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={config.evaluator_name}
                              onChange={(e) =>
                                updatePerTeamConfig(
                                  index,
                                  "evaluator_name",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Naam"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="email"
                              value={config.evaluator_email}
                              onChange={(e) =>
                                updatePerTeamConfig(
                                  index,
                                  "evaluator_email",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="email@bedrijf.nl"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={config.evaluator_organisation}
                              onChange={(e) =>
                                updatePerTeamConfig(
                                  index,
                                  "evaluator_organisation",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Organisatie"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            {config.status === "INVITED" ||
                            config.status === "IN_PROGRESS" ||
                            config.status === "SUBMITTED" ? (
                              <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                                ✓ Uitgenodigd
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSendPerTeamInvitation(index)}
                                disabled={submitting}
                                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Uitnodiging versturen
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* When disabled - show placeholder */}
        {!externalEnabled && (
          <div className="text-sm text-gray-500 italic">
            Schakel externe beoordeling in om opdrachtgevers uit te nodigen.
          </div>
        )}
      </section>
    </div>
  );
}
