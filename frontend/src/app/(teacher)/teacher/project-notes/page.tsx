"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { projectNotesService } from "@/services";
import { ProjectNotesContext } from "@/dtos/project-notes.dto";

export default function ProjectNotesOverviewPage() {
  const [projects, setProjects] = useState<ProjectNotesContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProject, setNewProject] = useState({
    title: "",
    course_id: undefined as number | undefined,
    class_name: "",
    description: "",
  });

  useEffect(() => {
    loadProjects();
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

  const handleCreateProject = async () => {
    try {
      await projectNotesService.createContext({
        title: newProject.title,
        course_id: newProject.course_id,
        class_name: newProject.class_name || null,
        description: newProject.description || null,
      });
      setShowNewProjectForm(false);
      setNewProject({ title: "", course_id: undefined, class_name: "", description: "" });
      loadProjects(); // Reload the list
    } catch (error) {
      console.error("Failed to create project:", error);
      alert("Fout bij aanmaken project. Probeer het opnieuw.");
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
          <button
            onClick={() => setShowNewProjectForm(!showNewProjectForm)}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Nieuw project
          </button>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vak/Cursus *
                  </label>
                  <input
                    type="text"
                    value={newProject.course}
                    onChange={(e) =>
                      setNewProject({ ...newProject, course: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Bijvoorbeeld: Ontwerpen"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Klas *
                  </label>
                  <input
                    type="text"
                    value={newProject.class_name}
                    onChange={(e) =>
                      setNewProject({ ...newProject, class_name: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Bijvoorbeeld: 3H"
                  />
                </div>
              </div>
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
                  onClick={() => setShowNewProjectForm(false)}
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
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-xl bg-white border border-gray-200/80 shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {project.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {project.course_name && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700 border border-blue-100">
                        {project.course_name}
                      </span>
                    )}
                    {project.class_name && (
                      <span className="rounded-full bg-slate-50 px-2.5 py-1 text-slate-700 border border-slate-100">
                        Klas {project.class_name}
                      </span>
                    )}
                  </div>
                </div>

                {project.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {project.description}
                  </p>
                )}

                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {project.note_count !== undefined && (
                    <span>{project.note_count} {project.note_count === 1 ? 'notitie' : 'notities'}</span>
                  )}
                </div>

                <Link
                  href={`/teacher/project-notes/${project.id}`}
                  className="block w-full rounded-lg bg-slate-700 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-800 transition-colors"
                >
                  Bekijk aantekeningen
                </Link>
              </div>
            </div>
          ))}
        </div>
        )}

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
