"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tabs } from "@/components/Tabs";
import { projectService } from "@/services/project.service";
import { listMailTemplates } from "@/services/mail-template.service";
import { useCourses } from "@/hooks";
import { Loading } from "@/components";
import type { MailTemplateDto } from "@/dtos/mail-template.dto";
import type { RunningProjectItem } from "@/dtos/project.dto";

// Default fallback templates when no templates are available from API
const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  opvolgmail: {
    subject: "Samenwerking volgend schooljaar",
    body: `Beste opdrachtgever,\n\nHet nieuwe schooljaar staat voor de deur en wij willen graag onze samenwerking voortzetten.\n\nHeeft u interesse om opnieuw een project met onze leerlingen te doen?\n\nMet vriendelijke groet,\nHet docententeam`,
  },
  startproject: {
    subject: "Uitnodiging startproject",
    body: `Beste opdrachtgever,\n\nGraag nodigen wij u uit voor de start van ons nieuwe project.\n\nWe kijken uit naar de samenwerking!\n\nMet vriendelijke groet,\nHet docententeam`,
  },
  tussenpresentatie: {
    subject: "Uitnodiging tussenpresentatie",
    body: `Beste opdrachtgever,\n\nGraag nodigen wij u uit voor de tussenpresentatie van ons project.\n\nMet vriendelijke groet,\nHet docententeam`,
  },
  eindpresentatie: {
    subject: "Uitnodiging eindpresentatie",
    body: `Beste opdrachtgever,\n\nGraag nodigen wij u uit voor de eindpresentatie van ons project.\n\nMet vriendelijke groet,\nHet docententeam`,
  },
  bedankmail: {
    subject: "Bedankt voor de samenwerking",
    body: `Beste opdrachtgever,\n\nHartelijk dank voor de prettige samenwerking.\n\nMet vriendelijke groet,\nHet docententeam`,
  },
};

// Extended project type with course level info
interface ProjectWithLevel extends RunningProjectItem {
  course_level?: string;
}

// Helper function for building mailto links
function buildMailto({ to, bcc, subject, body }: { to?: string; bcc?: string; subject: string; body: string }) {
  if (bcc) {
    return `mailto:?bcc=${bcc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  if (to) {
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Render status indicator
const renderStatusIndicator = (status: "complete" | "partial" | "not_started") => {
  const colors = {
    complete: "bg-green-400",
    partial: "bg-yellow-400",
    not_started: "bg-gray-300",
  };
  return <span className={`h-2 w-2 rounded-full ${colors[status]}`} />;
};

// Delete confirmation modal
function DeleteConfirmModal({
  isOpen,
  projectTitle,
  onConfirm,
  onCancel,
  isDeleting
}: {
  isOpen: boolean;
  projectTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Project verwijderen</h3>
        <p className="text-gray-600 text-sm mb-4">
          Weet je zeker dat je het project "{projectTitle}" wilt verwijderen? 
          Dit kan niet ongedaan worden gemaakt.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Annuleren
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? "Verwijderen..." : "Verwijderen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit project modal
function EditProjectModal({
  isOpen,
  project,
  onSave,
  onCancel,
  isSaving
}: {
  isOpen: boolean;
  project: ProjectWithLevel | null;
  onSave: (data: { title: string; class_name?: string; status: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(project?.project_title || "");
  const [className, setClassName] = useState(project?.class_name || "");
  const [status, setStatus] = useState(project?.project_status || "concept");

  useEffect(() => {
    if (project) {
      setTitle(project.project_title || "");
      setClassName(project.class_name || "");
      setStatus(project.project_status || "concept");
    }
  }, [project]);

  if (!isOpen || !project) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project bewerken</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Projecttitel *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Klas</label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="Bijv. GA2, AH3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="concept">Concept</option>
              <option value="active">Actief</option>
              <option value="completed">Afgerond</option>
              <option value="archived">Gearchiveerd</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Annuleren
          </button>
          <button
            onClick={() => onSave({ title, class_name: className || undefined, status })}
            disabled={isSaving || !title.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Project Table Component
function ProjectTable({ 
  projects, 
  selectedProjects, 
  toggleProjectSelection, 
  toggleAllProjects, 
  expandedProjects, 
  toggleProjectExpansion,
  isOnderbouw,
  onEditProject,
  onDeleteProject
}: {
  projects: ProjectWithLevel[];
  selectedProjects: number[];
  toggleProjectSelection: (id: number) => void;
  toggleAllProjects: () => void;
  expandedProjects: number[];
  toggleProjectExpansion: (id: number) => void;
  isOnderbouw: boolean;
  onEditProject: (project: ProjectWithLevel) => void;
  onDeleteProject: (project: ProjectWithLevel) => void;
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 space-y-3">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-gray-100 pb-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            {isOnderbouw ? "Onderbouw projecten" : "Bovenbouw keuzeprojecten"}
          </h2>
          <p className="text-xs text-gray-600">
            {isOnderbouw 
              ? <>Projecten gekoppeld aan een specifieke <span className="font-medium">Course (Vak)</span> in de onderbouw.</>
              : <>Keuzeprojecten met centrale beoordeling, peer en scan. Klik op een keuzeproject om details te zien.</>
            }
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span>Sorteren op</span>
          <select className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
            <option>{isOnderbouw ? "Startdatum" : "Course (Vak)"}</option>
            <option>Course (Vak)</option>
            <option>Projectnaam</option>
          </select>
        </div>
      </header>

      <div className="overflow-x-auto text-xs">
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b border-gray-100 text-[11px] text-gray-500 bg-gray-50/60">
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={projects.length > 0 && selectedProjects.length === projects.length}
                  onChange={toggleAllProjects}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="py-2 pr-4">Project</th>
              <th className="px-4 py-2">Course (Vak)</th>
              <th className="px-4 py-2">Opdrachtgever</th>
              <th className="px-4 py-2">Periode</th>
              <th className="px-4 py-2">Mail opdrachtgever</th>
              <th className="px-4 py-2 text-right">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {projects.map((project) => (
              <React.Fragment key={project.project_id}>
                {/* Main project row */}
                <tr className="hover:bg-gray-50 align-top">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedProjects.includes(project.project_id)}
                      onChange={() => toggleProjectSelection(project.project_id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-gray-900">{project.project_title}</span>
                      <span className="text-[11px] text-gray-500">
                        {project.class_name && `Klas: ${project.class_name}`}
                        {project.class_name && project.team_number && " · "}
                        {project.team_number && `Team ${project.team_number}`}
                      </span>
                      <span className="text-[11px] text-gray-400">{project.project_status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-[11px] text-gray-700">{project.course_name || "-"}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-800">{project.client_organization || "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-[11px] text-gray-600">
                    {project.start_date && project.end_date ? (
                      <>
                        {new Date(project.start_date).toLocaleDateString("nl-NL")} – {new Date(project.end_date).toLocaleDateString("nl-NL")}
                      </>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-2">
                    {project.client_email ? (
                      <a
                        href={`mailto:${project.client_email}?subject=Project: ${encodeURIComponent(project.project_title)}`}
                        className="inline-flex items-center px-3 py-1.5 text-[11px] font-medium text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-50"
                      >
                        📧 Mail
                      </a>
                    ) : (
                      <span className="text-slate-400 text-[11px]">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right align-top">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEditProject(project)}
                        className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Bewerken"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onDeleteProject(project)}
                        className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Verwijderen"
                      >
                        🗑️
                      </button>
                      <button
                        onClick={() => toggleProjectExpansion(project.project_id)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 ml-2"
                      >
                        Details
                        <span className="text-xs">{expandedProjects.includes(project.project_id) ? "▾" : "▸"}</span>
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Expanded details row */}
                {expandedProjects.includes(project.project_id) && (
                  <tr className="bg-gray-50/60">
                    <td colSpan={7} className="px-4 pb-3 pt-0">
                      <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px] text-gray-700">
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">Evaluatie</div>
                          <Link 
                            href={`/teacher/project-assessments?project_id=${project.project_id}`}
                            className="flex items-center gap-1 hover:underline"
                          >
                            {renderStatusIndicator("not_started")}
                            Bekijk beoordelingen
                          </Link>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">Peerevaluatie</div>
                          <Link 
                            href={`/teacher/evaluations?project_id=${project.project_id}`}
                            className="flex items-center gap-1 hover:underline"
                          >
                            {renderStatusIndicator("not_started")}
                            Bekijk peerevaluaties
                          </Link>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">Competentiescan</div>
                          <Link 
                            href={`/teacher/competencies?project_id=${project.project_id}`}
                            className="flex items-center gap-1 hover:underline"
                          >
                            {renderStatusIndicator("not_started")}
                            Bekijk scans
                          </Link>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">Aantekeningen</div>
                          <Link href={`/teacher/project-notes?project_id=${project.project_id}`} className="hover:underline">
                            Bekijk aantekeningen
                          </Link>
                        </div>
                      </div>
                      
                      {/* Team members if available */}
                      {project.student_names && project.student_names.length > 0 && (
                        <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                          <div className="text-xs font-semibold text-gray-800 mb-1">Teamleden</div>
                          <p className="text-[11px] text-gray-600">{project.student_names.join(", ")}</p>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}

            {projects.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Geen projecten gevonden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Tab Content Component (shared between Onderbouw and Bovenbouw)
function TabContent({ levelFilter }: { levelFilter: "onderbouw" | "bovenbouw" }) {
  const router = useRouter();
  const { courses } = useCourses();
  const [projects, setProjects] = useState<ProjectWithLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<number[]>([]);
  const [emailTemplate, setEmailTemplate] = useState("");
  const [availableCourses, setAvailableCourses] = useState<string[]>([]);
  
  // Mail templates from API
  const [mailTemplates, setMailTemplates] = useState<MailTemplateDto[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  
  // Edit/Delete modals
  const [editingProject, setEditingProject] = useState<ProjectWithLevel | null>(null);
  const [deletingProject, setDeletingProject] = useState<ProjectWithLevel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create a map of course_name -> level
  const courseLevelMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    courses.forEach(course => {
      if (course.name && course.level) {
        map[course.name] = course.level;
      }
    });
    return map;
  }, [courses]);

  // Fetch mail templates
  useEffect(() => {
    async function fetchMailTemplates() {
      try {
        setTemplatesLoading(true);
        const templates = await listMailTemplates({ is_active: true });
        setMailTemplates(templates);
        if (templates.length > 0) {
          setEmailTemplate((prev) => prev === "" ? templates[0].type : prev);
        } else {
          setEmailTemplate((prev) => prev === "" ? "opvolgmail" : prev);
        }
      } catch (err) {
        console.error("Error fetching mail templates:", err);
        setEmailTemplate((prev) => prev === "" ? "opvolgmail" : prev);
      } finally {
        setTemplatesLoading(false);
      }
    }
    fetchMailTemplates();
  }, []);

  // Fetch projects
  useEffect(() => {
    async function fetchProjects() {
      try {
        setLoading(true);
        const response = await projectService.getRunningProjectsOverview({ per_page: 100 });
        
        // Enrich with course level
        const enrichedProjects: ProjectWithLevel[] = (response.items || []).map(item => ({
          ...item,
          course_level: item.course_name ? courseLevelMap[item.course_name] : undefined,
        }));
        
        setProjects(enrichedProjects);
        
        // Extract unique courses for filter dropdown
        const uniqueCourses = Array.from(new Set(
          enrichedProjects
            .map(p => p.course_name)
            .filter((name): name is string => !!name)
        )).sort();
        setAvailableCourses(uniqueCourses);
      } catch (err) {
        console.error("Failed to fetch projects:", err);
        setError("Kon projecten niet laden");
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, [courseLevelMap]);

  // Filter projects based on level and search criteria
  const filteredProjects = projects.filter(project => {
    // Filter by level (onderbouw/bovenbouw)
    // If course has no level, show in both tabs
    if (project.course_level && project.course_level !== levelFilter) {
      return false;
    }
    
    // Search filter
    const matchesSearch = searchQuery === "" || 
      project.project_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.course_name && project.course_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (project.client_organization && project.client_organization.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Course filter
    const matchesCourse = courseFilter === "" || project.course_name === courseFilter;
    
    // Status filter
    const matchesStatus = statusFilter === "" || project.project_status === statusFilter;
    
    return matchesSearch && matchesCourse && matchesStatus;
  });

  const toggleProjectSelection = (projectId: number) => {
    setSelectedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const toggleAllProjects = () => {
    if (selectedProjects.length === filteredProjects.length) {
      setSelectedProjects([]);
    } else {
      setSelectedProjects(filteredProjects.map(p => p.project_id));
    }
  };

  const toggleProjectExpansion = (projectId: number) => {
    setExpandedProjects(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const resetFilters = () => {
    setSearchQuery("");
    setCourseFilter("");
    setStatusFilter("");
  };

  const handleSendBulkEmail = () => {
    const selectedEmails = filteredProjects
      .filter(p => selectedProjects.includes(p.project_id) && p.client_email)
      .map(p => p.client_email)
      .filter((email): email is string => !!email)
      .join(";");
    
    if (!selectedEmails) {
      alert("Geen opdrachtgevers met email geselecteerd");
      return;
    }
    
    // Use template from API or fallback
    const apiTemplate = mailTemplates.find(t => t.type === emailTemplate);
    let emailSubject: string;
    let emailBody: string;
    
    if (apiTemplate) {
      emailSubject = apiTemplate.subject;
      emailBody = apiTemplate.body;
    } else {
      const defaultTemplate = DEFAULT_TEMPLATES[emailTemplate] || DEFAULT_TEMPLATES.opvolgmail;
      emailSubject = defaultTemplate.subject;
      emailBody = defaultTemplate.body;
    }
    
    const mailtoLink = buildMailto({
      to: selectedEmails,
      subject: emailSubject,
      body: emailBody,
    });
    
    window.open(mailtoLink, '_self');
  };

  const handleEditProject = async (data: { title: string; class_name?: string; status: string }) => {
    if (!editingProject) return;
    
    setIsSaving(true);
    try {
      await projectService.updateProject(editingProject.project_id, {
        title: data.title,
        class_name: data.class_name,
        status: data.status,
      });
      
      // Update local state
      setProjects(prev => prev.map(p => 
        p.project_id === editingProject.project_id 
          ? { ...p, project_title: data.title, class_name: data.class_name, project_status: data.status }
          : p
      ));
      setEditingProject(null);
    } catch (err) {
      console.error("Failed to update project:", err);
      alert("Kon project niet bijwerken");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deletingProject) return;
    
    setIsDeleting(true);
    try {
      await projectService.deleteProject(deletingProject.project_id);
      
      // Remove from local state
      setProjects(prev => prev.filter(p => p.project_id !== deletingProject.project_id));
      setSelectedProjects(prev => prev.filter(id => id !== deletingProject.project_id));
      setDeletingProject(null);
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert("Kon project niet verwijderen");
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedWithEmail = filteredProjects.filter(
    p => selectedProjects.includes(p.project_id) && p.client_email
  ).length;

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Edit Modal */}
      <EditProjectModal
        isOpen={!!editingProject}
        project={editingProject}
        onSave={handleEditProject}
        onCancel={() => setEditingProject(null)}
        isSaving={isSaving}
      />
      
      {/* Delete Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingProject}
        projectTitle={deletingProject?.project_title || ""}
        onConfirm={handleDeleteProject}
        onCancel={() => setDeletingProject(null)}
        isDeleting={isDeleting}
      />
    
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
        <input
          type="text"
          placeholder="Zoek op titel, vak, opdrachtgever..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2 rounded-lg border w-64 text-sm"
        />
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
        >
          <option value="">Alle vakken</option>
          {availableCourses.map(course => (
            <option key={course} value={course}>{course}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
        >
          <option value="">Alle statussen</option>
          <option value="concept">Concept</option>
          <option value="active">Actief</option>
          <option value="completed">Afgerond</option>
        </select>
        <button
          onClick={resetFilters}
          className="px-3 py-2 text-sm rounded-lg border hover:bg-gray-50 ml-auto"
        >
          Reset
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-400" /> alles ingericht
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-yellow-400" /> deels ingericht
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-gray-300" /> nog niet gestart
        </span>
        <span className="ml-auto text-[11px] text-gray-500">
          Tip: gebruik de projectwizard om in één keer evaluaties, peer en scan aan een project te koppelen.
        </span>
      </div>

      {/* Bulk mail bar */}
      {selectedProjects.length > 0 && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">
                {selectedProjects.length} project{selectedProjects.length !== 1 ? "en" : ""} geselecteerd
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {selectedWithEmail} opdrachtgever(s) met email
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={emailTemplate}
                onChange={(e) => setEmailTemplate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                disabled={templatesLoading}
              >
                {templatesLoading ? (
                  <option>Laden...</option>
                ) : mailTemplates.length > 0 ? (
                  mailTemplates.map((t) => (
                    <option key={t.id} value={t.type}>{t.name}</option>
                  ))
                ) : (
                  <>
                    <option value="opvolgmail">Opvolgmail</option>
                    <option value="startproject">Startproject uitnodiging</option>
                    <option value="tussenpresentatie">Tussenpresentatie uitnodiging</option>
                    <option value="eindpresentatie">Eindpresentatie uitnodiging</option>
                    <option value="bedankmail">Bedankmail</option>
                  </>
                )}
              </select>
              <button
                onClick={handleSendBulkEmail}
                className="rounded-xl border border-sky-300 bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 shadow-sm"
              >
                📧 Mail versturen via Outlook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Table */}
      <ProjectTable
        projects={filteredProjects}
        selectedProjects={selectedProjects}
        toggleProjectSelection={toggleProjectSelection}
        toggleAllProjects={toggleAllProjects}
        expandedProjects={expandedProjects}
        toggleProjectExpansion={toggleProjectExpansion}
        isOnderbouw={levelFilter === "onderbouw"}
        onEditProject={setEditingProject}
        onDeleteProject={setDeletingProject}
      />
    </div>
  );
}

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState("onderbouw");

  const tabs = [
    {
      id: "onderbouw",
      label: "Onderbouw",
      content: <TabContent levelFilter="onderbouw" />,
    },
    {
      id: "bovenbouw",
      label: "Bovenbouw",
      content: <TabContent levelFilter="bovenbouw" />,
    },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Projecten
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Overzicht van alle projecten per <span className="font-medium">Course (Vak)</span>, met gekoppelde evaluaties,
              peerevaluaties, competentiescans en aantekeningen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/teacher/projects/new"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              + Nieuw project
            </Link>
            <Link
              href="/teacher/projects/new"
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Projectwizard openen
            </Link>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </>
  );
}
