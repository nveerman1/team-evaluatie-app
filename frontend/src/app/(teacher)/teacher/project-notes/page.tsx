"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { projectNotesService, courseService, projectService } from "@/services";
import { ProjectNotesContext } from "@/dtos/project-notes.dto";
import { Course } from "@/dtos/course.dto";
import type { ProjectListItem } from "@/dtos/project.dto";

const INITIAL_PROJECT_STATE = {
  title: "",
  project_id: undefined as number | undefined,
  course_id: undefined as number | undefined,
  description: "",
};

export default function ProjectNotesOverviewPage() {
  const [projects, setProjects] = useState<ProjectNotesContext[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [existingProjects, setExistingProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(new Set());
  const [linkToExistingProject, setLinkToExistingProject] = useState(false);
  const [newProject, setNewProject] = useState(INITIAL_PROJECT_STATE);

  useEffect(() => {
    loadProjects();
    loadCourses();
    loadExistingProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await projectNotesService.listContexts();
      setProjects(data);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const response = await courseService.listCourses({ is_active: true });
      setCourses(response.courses);
    } catch (error) {
      console.error("Failed to load courses:", error);
    }
  };

  const loadExistingProjects = async () => {
    try {
      const response = await projectService.listProjects();
      setExistingProjects(response.items || []);
    } catch (error) {
      console.error("Failed to load existing projects:", error);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.title || (!newProject.project_id && !newProject.course_id)) {
      alert("Vul minimaal een projectnaam in en selecteer een bestaand project of vak.");
      return;
    }
    
    try {
      await projectNotesService.createContext({
        title: newProject.title,
        project_id: newProject.project_id,
        course_id: newProject.course_id,
        class_name: null,
        description: newProject.description || null,
      });
      setShowNewProjectForm(false);
      setNewProject(INITIAL_PROJECT_STATE);
      setLinkToExistingProject(false);
      loadProjects(); // Reload the list
    } catch (error) {
      console.error("Failed to create project:", error);
      alert("Fout bij aanmaken project. Probeer het opnieuw.");
    }
  };

  const handleToggleProject = (projectId: number) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjects(newSelected);
  };

  const handleToggleAll = () => {
    if (selectedProjects.size === projects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(projects.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProjects.size === 0) {
      alert("Selecteer eerst projecten om te verwijderen.");
      return;
    }

    const confirmed = confirm(
      `Weet je zeker dat je ${selectedProjects.size} project(en) wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`
    );

    if (!confirmed) return;

    try {
      await Promise.all(
        Array.from(selectedProjects).map(id => 
          projectNotesService.deleteContext(id)
        )
      );
      setSelectedProjects(new Set());
      loadProjects();
    } catch (error) {
      console.error("Failed to delete projects:", error);
      alert("Fout bij verwijderen van projecten. Probeer het opnieuw.");
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Projectaantekeningen
            </h1>
            <p className="text-gray-600 mt-1 text-sm max-w-xl">
              Overzicht van alle projecten waarin je observaties en aantekeningen bijhoudt.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedProjects.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
              >
                Verwijder ({selectedProjects.size})
              </button>
            )}
            <button
              onClick={() => setShowNewProjectForm(!showNewProjectForm)}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              + Nieuw project
            </button>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* New Project Form */}
        {showNewProjectForm && (
          <div className="rounded-xl bg-white border border-gray-200/80 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Nieuw project aanmaken
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Projectnaam *
                </label>
                <input
                  type="text"
                  value={newProject.title}
                  onChange={(e) =>
                    setNewProject({ ...newProject, title: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Bijvoorbeeld: Duurzame wijk"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="link-existing"
                  checked={linkToExistingProject}
                  onChange={(e) => {
                    setLinkToExistingProject(e.target.checked);
                    if (e.target.checked) {
                      setNewProject({ ...newProject, course_id: undefined });
                    } else {
                      setNewProject({ ...newProject, project_id: undefined });
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="link-existing" className="text-sm font-medium text-gray-700">
                  Koppel aan bestaand project
                </label>
              </div>

              {linkToExistingProject ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bestaand project *
                  </label>
                  <select
                    value={newProject.project_id || ""}
                    onChange={(e) =>
                      setNewProject({ ...newProject, project_id: e.target.value ? Number(e.target.value) : undefined })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecteer een project...</option>
                    {existingProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vak *
                  </label>
                  <select
                    value={newProject.course_id || ""}
                    onChange={(e) =>
                      setNewProject({ ...newProject, course_id: e.target.value ? Number(e.target.value) : undefined })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecteer een vak...</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name} {course.code ? `(${course.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschrijving (optioneel)
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) =>
                    setNewProject({ ...newProject, description: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Korte beschrijving van het project..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowNewProjectForm(false);
                    setLinkToExistingProject(false);
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleCreateProject}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Project aanmaken
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Projecten laden...</p>
          </div>
        ) : projects.length > 0 ? (
          <>
            {/* Select All Checkbox */}
            <div className="flex items-center gap-2 px-2">
              <input
                type="checkbox"
                id="select-all"
                checked={selectedProjects.size === projects.length && projects.length > 0}
                onChange={handleToggleAll}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="select-all" className="text-sm text-gray-600 cursor-pointer">
                Selecteer alle projecten
              </label>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`rounded-xl bg-white border shadow-sm p-5 hover:shadow-md transition-shadow ${
                    selectedProjects.has(project.id) ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200/80'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedProjects.has(project.id)}
                        onChange={() => handleToggleProject(project.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {project.title}
                        </h3>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                          {project.course_name && (
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700 border border-blue-100">
                              {project.course_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {project.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 ml-7">
                        {project.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-gray-500 ml-7">
                      {project.note_count !== undefined && (
                        <span>{project.note_count} {project.note_count === 1 ? 'notitie' : 'notities'}</span>
                      )}
                    </div>

                    <Link
                      href={`/teacher/project-notes/${project.id}`}
                      className="block w-full rounded-lg bg-slate-700 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-800 transition-colors ml-7"
                      style={{ marginLeft: 0, width: '100%' }}
                    >
                      Bekijk aantekeningen
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {!loading && projects.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
            <p className="text-gray-500">
              Nog geen projecten aangemaakt. Klik op &quot;Nieuw project&quot; om te beginnen.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
