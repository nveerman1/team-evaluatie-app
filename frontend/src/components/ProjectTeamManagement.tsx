/**
 * Project Team Management Component
 * 
 * Allows teachers to:
 * - Select a project context
 * - View project-specific teams
 * - Clone teams from previous projects
 * - Create and manage project teams
 */

"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Copy, Plus, Users, Lock, Unlock } from "lucide-react";

// ============ Types ============

type Project = {
  id: number;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

type ProjectTeam = {
  id: number;
  project_id: number;
  team_id: number | null;
  display_name_at_time: string;
  version: number;
  members: ProjectTeamMember[];
  member_count: number;
  created_at: string;
  is_locked?: boolean;
};

type ProjectTeamMember = {
  id: number;
  user_id: number;
  role: string | null;
  user_name: string | null;
  user_email: string | null;
};

type ProjectTeamManagementProps = {
  courseId: number;
};

// ============ Component ============

export default function ProjectTeamManagement({ courseId }: ProjectTeamManagementProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectTeams, setProjectTeams] = useState<ProjectTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneSourceProject, setCloneSourceProject] = useState<Project | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<"success" | "error" | "info">("info");

  // Load projects for the course
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch(`/api/v1/projects?course_id=${courseId}&per_page=100`, {
          headers: {
            "X-User-Email": localStorage.getItem("user_email") || "",
          },
        });
        
        if (!response.ok) throw new Error("Failed to load projects");
        
        const data = await response.json();
        setProjects(data.projects || []);
        
        // Auto-select most recent active project only on initial load
        if (data.projects && data.projects.length > 0 && !selectedProject) {
          const activeProjects = data.projects.filter((p: Project) => p.status === "active");
          if (activeProjects.length > 0) {
            setSelectedProject(activeProjects[0]);
          }
        }
      } catch (error) {
        console.error("Error loading projects:", error);
        showAlert("Could not load projects", "error");
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
        const response = await fetch(
          `/api/v1/project-teams/projects/${selectedProject.id}/teams`,
          {
            headers: {
              "X-User-Email": localStorage.getItem("user_email") || "",
            },
          }
        );

        if (!response.ok) throw new Error("Failed to load project teams");

        const data = await response.json();
        setProjectTeams(data.teams || []);
      } catch (error) {
        console.error("Error loading project teams:", error);
        showAlert("Could not load project teams", "error");
      } finally {
        setLoading(false);
      }
    };

    loadProjectTeams();
  }, [selectedProject]);

  // Clone teams from another project
  const handleCloneTeams = async () => {
    if (!selectedProject || !cloneSourceProject) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/project-teams/projects/${selectedProject.id}/teams/clone-from/${cloneSourceProject.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Email": localStorage.getItem("user_email") || "",
          },
        }
      );

      if (!response.ok) throw new Error("Failed to clone teams");

      const data = await response.json();
      showAlert(
        `Successfully cloned ${data.teams_cloned} teams with ${data.members_cloned} members`,
        "success"
      );

      // Reload project teams
      const teamsResponse = await fetch(
        `/api/v1/project-teams/projects/${selectedProject.id}/teams`,
        {
          headers: {
            "X-User-Email": localStorage.getItem("user_email") || "",
          },
        }
      );
      const teamsData = await teamsResponse.json();
      setProjectTeams(teamsData.teams || []);

      setShowCloneModal(false);
      setCloneSourceProject(null);
    } catch (error) {
      console.error("Error cloning teams:", error);
      showAlert("Failed to clone teams", "error");
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      {/* Alert */}
      {alertMessage && (
        <div className={`mb-4 p-4 rounded-lg border ${getAlertStyles()}`}>
          {alertMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            Project Team Rosters
          </h2>
          <p className="text-sm text-gray-600">
            Manage frozen team compositions for projects
          </p>
        </div>
      </div>

      {/* Project Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Project
        </label>
        <div className="relative">
          <select
            value={selectedProject?.id || ""}
            onChange={(e) => {
              const project = projects.find((p) => p.id === parseInt(e.target.value));
              setSelectedProject(project || null);
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none pr-10"
          >
            <option value="">Select a project...</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title} ({project.status})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Actions */}
      {selectedProject && (
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setShowCloneModal(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Copy className="w-4 h-4" />
            Clone from Previous Project
          </button>
        </div>
      )}

      {/* Project Teams List */}
      {selectedProject && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Teams in {selectedProject.title}
          </h3>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-gray-600">Loading teams...</p>
            </div>
          ) : projectTeams.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No teams in this project yet</p>
              <p className="text-sm mt-1">Clone teams from another project to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projectTeams.map((team) => (
                <div
                  key={team.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-900">
                          {team.display_name_at_time}
                        </h4>
                        {team.is_locked && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded">
                            <Lock className="w-3 h-3" />
                            Locked
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          Version {team.version}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {team.member_count} member{team.member_count !== 1 ? "s" : ""}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {team.members.map((member) => (
                          <span
                            key={member.id}
                            className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                          >
                            {member.user_name}
                            {member.role && (
                              <span className="ml-1 text-xs text-gray-500">
                                ({member.role})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clone Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Clone Teams from Another Project
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Select a project to copy all team structures and members from:
            </p>

            <select
              value={cloneSourceProject?.id || ""}
              onChange={(e) => {
                const project = projects.find((p) => p.id === parseInt(e.target.value));
                setCloneSourceProject(project || null);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-6"
            >
              <option value="">Select source project...</option>
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
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCloneTeams}
                disabled={!cloneSourceProject || loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Cloning..." : "Clone Teams"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
