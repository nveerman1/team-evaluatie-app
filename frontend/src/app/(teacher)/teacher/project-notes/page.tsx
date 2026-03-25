"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { projectNotesService, courseService, projectService } from "@/services";
import { ProjectNotesContext } from "@/dtos/project-notes.dto";
import { Course } from "@/dtos/course.dto";
import type { ProjectListItem } from "@/dtos/project.dto";
import { Loading, ErrorMessage } from "@/components";

const INITIAL_PROJECT_STATE = {
  title: "",
  project_id: undefined as number | undefined,
  course_id: undefined as number | undefined,
  description: "",
};

export default function ProjectNotesOverviewPage() {
  const [projects, setProjects] = useState<ProjectNotesContext[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [existingProjects, setExistingProjects] = useState<ProjectListItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(
    new Set(),
  );
  const [linkToExistingProject, setLinkToExistingProject] = useState(false);
  const [newProject, setNewProject] = useState(INITIAL_PROJECT_STATE);
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");

  useEffect(() => {
    loadProjects();
    loadCourses();
    loadExistingProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await projectNotesService.listContexts();
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError("Fout bij laden van projecten.");
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
    if (
      !newProject.title ||
      (!newProject.project_id && !newProject.course_id)
    ) {
      alert(
        "Vul minimaal een projectnaam in en selecteer een bestaand project of vak.",
      );
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
      loadProjects();
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
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filteredProjects.map((p) => p.id)));
    }
  };

  const handleDeleteSingle = async (projectId: number) => {
    const confirmed = confirm(
      "Weet je zeker dat je dit project wilt verwijderen? Dit kan niet ongedaan worden gemaakt.",
    );
    if (!confirmed) return;
    try {
      await projectNotesService.deleteContext(projectId);
      setSelectedProjects((prev) => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
      loadProjects();
    } catch (error) {
      console.error("Failed to delete project:", error);
      alert("Fout bij verwijderen van project. Probeer het opnieuw.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProjects.size === 0) {
      alert("Selecteer eerst projecten om te verwijderen.");
      return;
    }

    const confirmed = confirm(
      `Weet je zeker dat je ${selectedProjects.size} project(en) wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`,
    );

    if (!confirmed) return;

    try {
      await Promise.all(
        Array.from(selectedProjects).map((id) =>
          projectNotesService.deleteContext(id),
        ),
      );
      setSelectedProjects(new Set());
      loadProjects();
    } catch (error) {
      console.error("Failed to delete projects:", error);
      alert("Fout bij verwijderen van projecten. Probeer het opnieuw.");
    }
  };

  // Build unique courses list from loaded projects
  const uniqueCourses = Array.from(
    new Set(
      projects
        .map((p) => p.course_name)
        .filter((name): name is string => Boolean(name)),
    ),
  );

  // Filter projects by search query and course filter
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      searchQuery === "" ||
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.course_name &&
        project.course_name
          .toLowerCase()
          .includes(searchQuery.toLowerCase())) ||
      (project.description &&
        project.description
          .toLowerCase()
          .includes(searchQuery.toLowerCase()));
    const matchesCourse =
      courseFilter === "all" || project.course_name === courseFilter;
    return matchesSearch && matchesCourse;
  });

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Projectaantekeningen
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Overzicht van alle projecten waarin je observaties en
              aantekeningen bijhoudt.
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
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
                <label
                  htmlFor="link-existing"
                  className="text-sm font-medium text-gray-700"
                >
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
                      setNewProject({
                        ...newProject,
                        project_id: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
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
                      setNewProject({
                        ...newProject,
                        course_id: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
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
                    setNewProject({
                      ...newProject,
                      description: e.target.value,
                    })
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

        {/* Filter Bar */}
        <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-3 items-center flex-1">
              {/* Search field */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Zoek op titel, vak of beschrijving…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Course dropdown */}
              <select
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 min-w-[140px]"
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
              >
                <option value="all">Alle vakken</option>
                {uniqueCourses.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Select all checkbox */}
              {filteredProjects.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={
                      selectedProjects.size === filteredProjects.length &&
                      filteredProjects.length > 0
                    }
                    onChange={handleToggleAll}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Selecteer alle
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Loading / Error states */}
        {loading && (
          <div className="p-6">
            <Loading />
          </div>
        )}
        {error && !loading && (
          <div className="p-6">
            <ErrorMessage message={error} />
          </div>
        )}

        {/* Projects List */}
        {!loading && !error && filteredProjects.length > 0 && (
          <div className="space-y-3">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className={`group flex items-stretch justify-between gap-4 rounded-xl border bg-white/80 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  selectedProjects.has(project.id)
                    ? "border-blue-400 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Checkbox */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedProjects.has(project.id)}
                    onChange={() => handleToggleProject(project.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>

                {/* Left side: content */}
                <div className="flex flex-1 flex-col gap-1">
                  {/* Title + course badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-slate-900">
                      {project.title}
                    </h3>
                    {project.course_name && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 border border-blue-100">
                        {project.course_name}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="text-sm text-slate-500 line-clamp-1">
                      {project.description}
                    </p>
                  )}

                  {/* Note count */}
                  {project.note_count !== undefined && (
                    <div className="text-xs text-slate-500">
                      {project.note_count}{" "}
                      {project.note_count === 1 ? "notitie" : "notities"}
                    </div>
                  )}
                </div>

                {/* Right side: buttons */}
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/teacher/project-notes/${project.id}`}
                    className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    Bekijk aantekeningen
                  </Link>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteSingle(project.id)}
                    aria-label="Verwijder project"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-500 transition hover:border-red-200 hover:bg-red-100"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && projects.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-500">
            Nog geen projecten aangemaakt. Klik op &quot;Nieuw project&quot; om
            te beginnen.
          </div>
        )}

        {/* No results after filtering */}
        {!loading && !error && projects.length > 0 && filteredProjects.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-500">
            Geen projecten gevonden voor de huidige filters.
          </div>
        )}
      </main>
    </>
  );
}
