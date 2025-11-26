"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
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

  // State for basic settings (editable)
  const [editTitle, setEditTitle] = useState("");
  const [editRubricId, setEditRubricId] = useState<number>(0);
  const [savingBasicSettings, setSavingBasicSettings] = useState(false);

  // State for external assessment configuration
  const [externalEnabled, setExternalEnabled] = useState(false);
  const [externalMode, setExternalMode] = useState<ExternalMode>("none");
  const [savingExternalSettings, setSavingExternalSettings] = useState(false);

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
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [teamOverview, rubricList] = await Promise.all([
        projectAssessmentService.getTeamOverview(assessmentId),
        rubricService.getRubrics(undefined, "project"),
      ]);
      
      setData(teamOverview);
      setRubrics(rubricList.items?.map((r: { id: number; title: string }) => ({ id: r.id, title: r.title })) || []);

      // Initialize editable basic settings
      setEditTitle(teamOverview.assessment.title);
      setEditRubricId(teamOverview.assessment.rubric_id);

      // Initialize external assessment settings from metadata_json
      const externalSettings = teamOverview.assessment.metadata_json?.external_assessment;
      if (externalSettings) {
        setExternalEnabled(externalSettings.enabled || false);
        setExternalMode(externalSettings.mode || "none");
        if (externalSettings.all_teams_config) {
          setAllTeamsConfig((prev) => ({
            ...prev,
            evaluator_name: externalSettings.all_teams_config.evaluator_name || "",
            evaluator_email: externalSettings.all_teams_config.evaluator_email || "",
            evaluator_organisation: externalSettings.all_teams_config.evaluator_organisation || "",
            rubric_id: externalSettings.all_teams_config.rubric_id || 0,
          }));
        }
      }

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
  }, [assessmentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle enabling/disabling external assessment
  const handleExternalToggle = (enabled: boolean) => {
    setExternalEnabled(enabled);
    if (!enabled) {
      setExternalMode("none");
    }
  };

  // Handle saving basic settings (title and rubric)
  const handleSaveBasicSettings = async () => {
    if (!editTitle.trim()) {
      setSubmitError("Titel mag niet leeg zijn.");
      return;
    }
    if (editRubricId <= 0) {
      setSubmitError("Selecteer een rubric.");
      return;
    }

    setSavingBasicSettings(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      await projectAssessmentService.updateProjectAssessment(assessmentId, {
        title: editTitle,
        rubric_id: editRubricId,
      });
      
      // Update local data to reflect changes
      if (data) {
        const selectedRubric = rubrics.find(r => r.id === editRubricId);
        setData({
          ...data,
          assessment: {
            ...data.assessment,
            title: editTitle,
            rubric_id: editRubricId,
          },
          rubric_title: selectedRubric?.title || data.rubric_title,
        });
      }
      
      setSuccessMessage("Basisinstellingen opgeslagen.");
    } catch (e: unknown) {
      console.error("Failed to save basic settings:", e);
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setSubmitError(
        err?.response?.data?.detail ||
          "Kon instellingen niet opslaan. Probeer het opnieuw."
      );
    } finally {
      setSavingBasicSettings(false);
    }
  };

  // Handle saving external assessment settings
  const handleSaveExternalSettings = async () => {
    setSavingExternalSettings(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const currentMetadata = data?.assessment.metadata_json || {};
      const updatedMetadata = {
        ...currentMetadata,
        external_assessment: {
          enabled: externalEnabled,
          mode: externalMode,
          all_teams_config: externalMode === "all_teams" ? {
            evaluator_name: allTeamsConfig.evaluator_name,
            evaluator_email: allTeamsConfig.evaluator_email,
            evaluator_organisation: allTeamsConfig.evaluator_organisation,
            rubric_id: allTeamsConfig.rubric_id,
          } : undefined,
        },
      };

      await projectAssessmentService.updateProjectAssessment(assessmentId, {
        metadata_json: updatedMetadata,
      });

      // Update local data to reflect changes
      if (data) {
        setData({
          ...data,
          assessment: {
            ...data.assessment,
            metadata_json: updatedMetadata,
          },
        });
      }

      setSuccessMessage("Externe beoordeling instellingen opgeslagen.");
    } catch (e: unknown) {
      console.error("Failed to save external settings:", e);
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setSubmitError(
        err?.response?.data?.detail ||
          "Kon instellingen niet opslaan. Probeer het opnieuw."
      );
    } finally {
      setSavingExternalSettings(false);
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
    } catch (e: unknown) {
      console.error("Failed to send invitation:", e);
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setSubmitError(
        err?.response?.data?.detail ||
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
    } catch (e: unknown) {
      console.error("Failed to send invitation:", e);
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setSubmitError(
        err?.response?.data?.detail ||
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

  // Calculate KPI statistics
  const totalTeams = data.teams.length;
  const teamsWithRubric = totalTeams; // All teams share the same rubric

  return (
    <>
      {/* Action buttons - aligned right */}
      <div className="flex items-center justify-end">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => loadData()}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            disabled={loading}
          >
            ⟳ Verversen
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-green-800 shadow-sm">
          ✅ {successMessage}
        </div>
      )}
      {submitError && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 shadow-sm">
          ❌ {submitError}
        </div>
      )}

      {/* KPI Cards - styled like OMZA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-blue-100 bg-white/70 p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 mb-1">
            Totaal teams
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            {totalTeams}
          </p>
        </div>
        <div className="rounded-xl border border-green-100 bg-white/70 p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 mb-1">
            Met rubric
          </h3>
          <p className="text-2xl font-bold text-green-600">
            {teamsWithRubric}
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-white/70 p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 mb-1">
            Extern ingeschakeld
          </h3>
          <p className="text-2xl font-bold text-amber-600">
            {externalEnabled ? "Ja" : "Nee"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white/70 p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 mb-1">
            Extern modus
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            {externalMode === "all_teams" ? "Alle teams" : externalMode === "per_team" ? "Per team" : "Geen"}
          </p>
        </div>
      </div>

      {/* Card 1: Basis instellingen beoordeling */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Basis instellingen beoordeling
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Titel</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Titel van de beoordeling"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Rubric</label>
            <select
              value={editRubricId}
              onChange={(e) => setEditRubricId(Number(e.target.value))}
              className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={0}>Selecteer een rubric</option>
              {rubrics.map((rubric) => (
                <option key={rubric.id} value={rubric.id}>
                  {rubric.title}
                </option>
              ))}
            </select>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSaveBasicSettings}
              disabled={savingBasicSettings}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
            >
              {savingBasicSettings ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        </div>
      </div>

      {/* Card 2: Externe beoordeling (advies) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Externe beoordeling (advies)
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Opdrachtgevers kunnen een adviesbeoordeling geven. Jij bepaalt het
            uiteindelijke cijfer.
          </p>
        </div>
        <div className="p-6 space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center gap-3">
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
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setExternalMode("none")}
                    className={`px-4 py-2 rounded-xl border font-medium shadow-sm ${
                      externalMode === "none"
                        ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Geen extern
                  </button>
                  <button
                    onClick={() => setExternalMode("all_teams")}
                    className={`px-4 py-2 rounded-xl border font-medium shadow-sm ${
                      externalMode === "all_teams"
                        ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Eén opdrachtgever (alle teams)
                  </button>
                  <button
                    onClick={() => setExternalMode("per_team")}
                    className={`px-4 py-2 rounded-xl border font-medium shadow-sm ${
                      externalMode === "per_team"
                        ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Per team eigen opdrachtgever
                  </button>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
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
                        className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Jan Jansen"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
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
                        className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="jan@bedrijf.nl"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
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
                        className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Bedrijf B.V."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 max-h-60 overflow-y-auto space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer border-b border-gray-100 pb-2 mb-2">
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
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
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

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                              Team
                            </th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide min-w-[150px]">
                              Teamleden
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide min-w-[150px]">
                              Opdrachtgever naam
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide min-w-[180px]">
                              E-mail
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide min-w-[150px]">
                              Organisatie
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 tracking-wide">
                              Acties
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {perTeamConfigs.map((config, index) => (
                            <tr
                              key={`perteam-${config.group_id}-${config.team_number}-${index}`}
                              className="bg-white hover:bg-gray-50"
                            >
                              <td className="px-5 py-3">
                                <span className="font-medium text-gray-900">{config.team_name}</span>
                              </td>
                              <td className="px-5 py-3">
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
                                  className="w-full h-8 rounded-lg border border-gray-300 bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                  className="w-full h-8 rounded-lg border border-gray-300 bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                  className="w-full h-8 rounded-lg border border-gray-300 bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Organisatie"
                                />
                              </td>
                              <td className="px-4 py-3 text-right">
                                {config.status === "INVITED" ||
                                config.status === "IN_PROGRESS" ||
                                config.status === "SUBMITTED" ? (
                                  <span className="px-3 py-1 rounded-full border text-xs font-medium bg-green-100 text-green-800">
                                    ✓ Uitgenodigd
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSendPerTeamInvitation(index)}
                                    disabled={submitting}
                                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
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

          {/* Save External Settings Button */}
          <div className="pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={handleSaveExternalSettings}
              disabled={savingExternalSettings}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
            >
              {savingExternalSettings ? "Opslaan..." : "Instellingen opslaan"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
