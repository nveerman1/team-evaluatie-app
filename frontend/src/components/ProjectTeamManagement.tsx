/**
 * Project Team Management Component
 * 
 * Allows teachers to:
 * - Select a project context
 * - View project-specific teams
 * - Clone teams from previous projects
 * - Create and manage project teams
 * - Emit selection to parent for roster view
 */

"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Copy, Plus, Users, Lock, Unlock } from "lucide-react";
import { projectService } from "@/services/project.service";
import { projectTeamService } from "@/services/project-team.service";
import type { ProjectListItem } from "@/dtos/project.dto";
import type { ProjectTeam } from "@/dtos/project-team.dto";

// ============ Types ============

type ProjectTeamManagementProps = {
  courseId: number;
  onSelectProject?: (projectId: number | null) => void;
  onSelectProjectTeam?: (projectTeamId: number | null) => void;
};

// ============ Component ============

export default function ProjectTeamManagement({ 
  courseId, 
  onSelectProject,
  onSelectProjectTeam 
}: ProjectTeamManagementProps) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectListItem | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [projectTeams, setProjectTeams] = useState<ProjectTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneSourceProject, setCloneSourceProject] = useState<ProjectListItem | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<"success" | "error" | "info">("info");

  // Load projects for the course
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await projectService.listProjects({
          course_id: courseId,
          per_page: 100,
        });
        
        setProjects(data.items || []);
        
        // Auto-select most recent active project only on initial load
        if (data.items && data.items.length > 0 && !selectedProject) {
          const activeProjects = data.items.filter((p) => p.status === "active");
          if (activeProjects.length > 0) {
            handleProjectSelect(activeProjects[0]);
          }
        }
      } catch (error) {
        console.error("Error loading projects:", error);
        showAlert("Kon projecten niet laden", "error");
      }
    };

    if (courseId) {
      loadProjects();
    }
  }, [courseId]); // Only re-run when courseId changes

  // Load project teams when project is selected
  useEffect(() => {
    const loadProjectTeams = async () => {
      if (!selectedProject) {
        setProjectTeams([]);
        return;
      }

      setLoading(true);
      try {
        const response = await projectTeamService.listProjectTeams(selectedProject.id);
        setProjectTeams(response.teams || []);
      } catch (error) {
        console.error("Error loading project teams:", error);
        showAlert("Kon projectteams niet laden", "error");
      } finally {
        setLoading(false);
      }
    };

    loadProjectTeams();
  }, [selectedProject]);

  const handleProjectSelect = (project: ProjectListItem | null) => {
    setSelectedProject(project);
    setSelectedTeamId(null);
    onSelectProject?.(project?.id ?? null);
    onSelectProjectTeam?.(null);
  };

  const handleTeamSelect = (teamId: number) => {
    setSelectedTeamId(teamId);
    onSelectProjectTeam?.(teamId);
  };

  // Clone teams from another project
  const handleCloneTeams = async () => {
    if (!selectedProject || !cloneSourceProject) return;

    setLoading(true);
    try {
      const response = await projectTeamService.cloneProjectTeams(
        selectedProject.id,
        cloneSourceProject.id
      );

      showAlert(
        `${response.teams_cloned} teams met ${response.members_cloned} leden succesvol gekopieerd`,
        "success"
      );

      // Reload project teams
      const teamsResponse = await projectTeamService.listProjectTeams(selectedProject.id);
      setProjectTeams(teamsResponse.teams || []);

      setShowCloneModal(false);
      setCloneSourceProject(null);
    } catch (error) {
      console.error("Error cloning teams:", error);
      showAlert("Kon teams niet kopiëren", "error");
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (message: string, type: "success" | "error" | "info") => {
    setAlertMessage(message);
    setAlertType(type);
    setTimeout(() => setAlertMessage(null), 5000);
  };

  const getAlertStyles = () => {
    switch (alertType) {
      case "success":
        return "bg-green-50 border-green-200 text-green-800";
      case "error":
        return "bg-red-50 border-red-200 text-red-800";
      default:
        return "bg-blue-50 border-blue-200 text-blue-800";
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
      {/* Alert */}
      {alertMessage && (
        <div className={`mb-4 p-4 rounded-lg border ${getAlertStyles()}`}>
          {alertMessage}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-1">
          Projectteams
        </h2>
        <p className="text-gray-600 mt-1 text-sm">
          Projectteams vorige projecten
        </p>
      </div>

      {/* Project Selector */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-500 mb-2">
          Selecteer project
        </label>
        <div className="relative">
          <select
            value={selectedProject?.id || ""}
            onChange={(e) => {
              const project = projects.find((p) => p.id === parseInt(e.target.value));
              handleProjectSelect(project || null);
            }}
            className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none pr-10"
          >
            <option value="">Selecteer een project...</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title} ({project.status})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Actions */}
      {selectedProject && (
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setShowCloneModal(true)}
            disabled={loading}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Copy className="w-4 h-4" />
            Kopieer van eerder project
          </button>
        </div>
      )}

      {/* Project Teams List */}
      {selectedProject && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Teams in {selectedProject.title}
          </h3>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-sm text-gray-600">Laden...</p>
            </div>
          ) : projectTeams.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-sm">Nog geen teams in dit project</p>
              <p className="text-xs mt-1 text-gray-400">Kopieer teams van een ander project om te beginnen</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projectTeams.map((team) => {
                const isSelected = selectedTeamId === team.id;
                
                return (
                  <button
                    key={team.id}
                    onClick={() => handleTeamSelect(team.id)}
                    className={`w-full border rounded-lg p-4 text-left transition-colors ${
                      isSelected 
                        ? "border-blue-500 bg-blue-50" 
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-gray-900 text-sm">
                            {team.display_name_at_time}
                          </h4>
                          {team.is_locked && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded" title="Vergrendeld">
                              <Lock className="w-3 h-3" />
                            </span>
                          )}
                          <span className="text-xs text-gray-500" title={`Versie ${team.version}`}>
                            v{team.version}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">
                          {team.member_count} {team.member_count !== 1 ? "leden" : "lid"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Clone Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold tracking-tight text-gray-900 mb-2">
              Teams kopiëren
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Selecteer een project om alle teamstructuren en leden van te kopiëren:
            </p>

            <select
              value={cloneSourceProject?.id || ""}
              onChange={(e) => {
                const project = projects.find((p) => p.id === parseInt(e.target.value));
                setCloneSourceProject(project || null);
              }}
              className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-6"
            >
              <option value="">Selecteer bronproject...</option>
              {projects
                .filter((p) => p.id !== selectedProject?.id)
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCloneModal(false);
                  setCloneSourceProject(null);
                }}
                className="flex-1 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuleren
              </button>
              <button
                onClick={handleCloneTeams}
                disabled={!cloneSourceProject || loading}
                className="flex-1 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Kopiëren..." : "Kopieer teams"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
