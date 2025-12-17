"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tabs } from "@/components/Tabs";
import { projectService } from "@/services/project.service";
import { clientService } from "@/services/client.service";
import { courseService } from "@/services/course.service";
import { listMailTemplates } from "@/services/mail-template.service";
import { useCourses } from "@/hooks";
import { Loading } from "@/components";
import { SearchableMultiSelect } from "@/components/form/SearchableMultiSelect";
import type { MailTemplateDto } from "@/dtos/mail-template.dto";
import type { RunningProjectItem, Subproject } from "@/dtos/project.dto";
import type { ClientListItem } from "@/dtos/client.dto";
import type { Course, CourseStudent } from "@/dtos/course.dto";

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

// Extended project type with course level info and evaluation counts
interface ProjectWithLevel extends RunningProjectItem {
  course_level?: string;
  course_id?: number;
  description?: string;
  // Evaluation counts from project details
  evaluation_counts?: Record<string, number>;
  note_count?: number;
  client_count?: number;
  // Subprojects for bovenbouw choice projects (from API)
  subprojects?: Subproject[];
}

// Team type for course teams
interface CourseTeam {
  team_number: number;
  members: CourseStudent[];
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
        <p className="text-gray-600 text-sm mb-2">
          Weet je zeker dat je het project &quot;{projectTitle}&quot; wilt verwijderen?
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-yellow-800 text-xs font-medium mb-1">⚠️ Let op:</p>
          <p className="text-yellow-700 text-xs">
            Dit verwijdert ook alle gekoppelde gegevens:
          </p>
          <ul className="text-yellow-700 text-xs list-disc list-inside mt-1 space-y-0.5">
            <li>Peerevaluaties</li>
            <li>Projectbeoordelingen</li>
            <li>Deelprojecten</li>
            <li>Aantekeningen</li>
          </ul>
          <p className="text-yellow-800 text-xs font-medium mt-2">
            Dit kan niet ongedaan worden gemaakt.
          </p>
        </div>
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

// Type for subproject data passed to onSave
interface SubprojectData {
  title: string;
  client_id?: number;
  team_number?: number;
}

// Subproject modal for creating/editing deelprojecten
function SubprojectModal({
  isOpen,
  projectTitle,
  courseId,
  onSave,
  onCancel,
  isSaving: externalIsSaving = false,
}: {
  isOpen: boolean;
  projectTitle: string;
  courseId?: number;
  onSave: (subproject: SubprojectData) => void | Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedTeamNumber, setSelectedTeamNumber] = useState<number | null>(null);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [teams, setTeams] = useState<CourseTeam[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Fetch clients when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingClients(true);
      clientService.listClients({ per_page: 100 })
        .then(response => {
          setClients(response.items || []);
        })
        .catch(err => {
          console.error("Failed to load clients:", err);
        })
        .finally(() => setLoadingClients(false));
    }
  }, [isOpen]);

  // Fetch teams from course when modal opens
  useEffect(() => {
    if (isOpen && courseId) {
      setLoadingTeams(true);
      courseService.getCourseStudents(courseId)
        .then(students => {
          // Group students by team_number
          const teamMap = new Map<number, CourseStudent[]>();
          students.forEach(student => {
            if (student.team_number !== undefined && student.team_number !== null) {
              if (!teamMap.has(student.team_number)) {
                teamMap.set(student.team_number, []);
              }
              teamMap.get(student.team_number)!.push(student);
            }
          });
          
          // Convert to array and sort by team number
          const teamsArray: CourseTeam[] = Array.from(teamMap.entries())
            .map(([team_number, members]) => ({ team_number, members }))
            .sort((a, b) => a.team_number - b.team_number);
          
          setTeams(teamsArray);
        })
        .catch(err => {
          console.error("Failed to load teams:", err);
        })
        .finally(() => setLoadingTeams(false));
    }
  }, [isOpen, courseId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setSelectedClientId(null);
      setSelectedTeamNumber(null);
    }
  }, [isOpen]);

  const selectedTeam = teams.find(t => t.team_number === selectedTeamNumber);

  const handleSave = () => {
    if (!title.trim()) return;
    
    const subprojectData: SubprojectData = {
      title: title.trim(),
      client_id: selectedClientId || undefined,
      team_number: selectedTeamNumber || undefined,
    };
    
    onSave(subprojectData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Nieuw deelproject</h3>
        <p className="text-sm text-gray-600 mb-4">
          Voeg een deelproject toe aan &quot;{projectTitle}&quot;
        </p>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titel <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bijv. Windturbine redesign"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Client dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opdrachtgever
            </label>
            {loadingClients ? (
              <div className="text-sm text-gray-500">Laden...</div>
            ) : (
              <SearchableMultiSelect
                options={clients.map(client => ({
                  id: client.id,
                  label: client.organization,
                  subtitle: client.contact_name
                }))}
                value={selectedClientId ? [selectedClientId] : []}
                onChange={(ids) => setSelectedClientId(ids.length > 0 ? ids[0] : null)}
                placeholder="Zoek en selecteer opdrachtgever..."
                loading={loadingClients}
                className="w-full"
              />
            )}
          </div>

          {/* Team dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team
            </label>
            {loadingTeams ? (
              <div className="text-sm text-gray-500">Teams laden...</div>
            ) : teams.length === 0 ? (
              <div className="text-sm text-gray-500 italic">
                {courseId ? "Geen teams gevonden voor dit vak." : "Selecteer eerst een vak met teams."}
              </div>
            ) : (
              <select
                value={selectedTeamNumber || ""}
                onChange={(e) => setSelectedTeamNumber(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecteer een team...</option>
                {teams.map(team => (
                  <option key={team.team_number} value={team.team_number}>
                    Team {team.team_number} ({team.members.length} leden)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Team members preview */}
          {selectedTeam && selectedTeam.members.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-700 mb-1">Teamleden</div>
              <div className="text-xs text-gray-600">
                {selectedTeam.members.map(m => m.name).join(", ")}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onCancel}
            disabled={externalIsSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={externalIsSaving || !title.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {externalIsSaving ? "Toevoegen..." : "Toevoegen"}
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
  courses,
  onSave,
  onCancel,
  isSaving
}: {
  isOpen: boolean;
  project: ProjectWithLevel | null;
  courses: Course[];
  onSave: (data: { 
    title: string; 
    class_name?: string; 
    status: string;
    course_id?: number;
    start_date?: string;
    end_date?: string;
    description?: string;
    client_ids?: number[];
  }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(project?.project_title || "");
  const [className, setClassName] = useState(project?.class_name || "");
  const [status, setStatus] = useState(project?.project_status || "concept");
  const [courseId, setCourseId] = useState<number | "">(project?.course_id || "");
  const [startDate, setStartDate] = useState(project?.start_date?.split("T")[0] || "");
  const [endDate, setEndDate] = useState(project?.end_date?.split("T")[0] || "");
  const [description, setDescription] = useState(project?.description || "");
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>(
    project?.client_id ? [project.client_id] : []
  );
  
  // Client loading state
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientsLoaded, setClientsLoaded] = useState(false);

  // Load clients when modal opens
  useEffect(() => {
    async function loadClients() {
      if (!isOpen || clientsLoaded) return;
      
      setLoadingClients(true);
      try {
        const response = await clientService.listClients({ per_page: 100 });
        setClients(response.items || []);
        setClientsLoaded(true);
      } catch (err) {
        console.error("Failed to load clients:", err);
        setClientsLoaded(true);
      } finally {
        setLoadingClients(false);
      }
    }
    loadClients();
  }, [isOpen, clientsLoaded]);

  useEffect(() => {
    if (project) {
      setTitle(project.project_title || "");
      setClassName(project.class_name || "");
      setStatus(project.project_status || "concept");
      setCourseId(project.course_id || "");
      setStartDate(project.start_date?.split("T")[0] || "");
      setEndDate(project.end_date?.split("T")[0] || "");
      setDescription(project.description || "");
      setSelectedClientIds(project.client_id ? [project.client_id] : []);
      // Reset clients loaded to reload when project changes
      setClientsLoaded(false);
    }
  }, [project]);

  if (!isOpen || !project) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
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
            <label className="block text-sm font-medium mb-1">Course (Vak)</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Geen vak geselecteerd</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name} {course.level ? `(${course.level})` : ""}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Opdrachtgever(s)</label>
            <SearchableMultiSelect
              options={clients.map(client => ({
                id: client.id,
                label: client.organization,
                subtitle: client.contact_name
              }))}
              value={selectedClientIds}
              onChange={setSelectedClientIds}
              placeholder="Zoek en selecteer opdrachtgevers..."
              loading={loadingClients}
              className="w-full"
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
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Startdatum</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Einddatum</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Beschrijving</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Korte beschrijving van het project..."
              rows={3}
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
            onClick={() => onSave({ 
              title, 
              class_name: className || undefined, 
              status,
              course_id: courseId === "" ? undefined : courseId,
              start_date: startDate || undefined,
              end_date: endDate || undefined,
              description: description || undefined,
              client_ids: selectedClientIds.length > 0 ? selectedClientIds : undefined,
            })}
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
  onDeleteProject,
  onAddSubproject
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
  onAddSubproject: (project: ProjectWithLevel) => void;
}) {
  // Determine column count based on tab
  const colSpan = isOnderbouw ? 7 : 5; // onderbouw has 7 cols, bovenbouw has 5 cols (no opdrachtgever, no mail)
  
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
              {isOnderbouw && <th className="px-4 py-2">Opdrachtgever</th>}
              <th className="px-4 py-2">Periode</th>
              {isOnderbouw && <th className="px-4 py-2">Mail opdrachtgever</th>}
              <th className="px-4 py-2 text-right">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {projects.map((project) => (
              <React.Fragment key={project.project_id}>
                {/* Main project row - clickable to expand/collapse */}
                <tr 
                  className="hover:bg-gray-50 align-top cursor-pointer"
                  onClick={() => toggleProjectExpansion(project.project_id)}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedProjects.includes(project.project_id)}
                      onChange={() => toggleProjectSelection(project.project_id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-gray-900">
                        {project.project_title}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {project.class_name && `Klas: ${project.class_name}`}
                        {project.class_name && project.team_number && " · "}
                        {project.team_number && `Team ${project.team_number}`}
                      </span>
                      <span className="text-[11px] text-gray-400">{project.project_status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-[11px] text-gray-700">{project.course_name || "-"}</td>
                  {isOnderbouw && (
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-800">{project.client_organization || "-"}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-2 text-[11px] text-gray-600">
                    {project.start_date && project.end_date ? (
                      <>
                        {new Date(project.start_date).toLocaleDateString("nl-NL")} – {new Date(project.end_date).toLocaleDateString("nl-NL")}
                      </>
                    ) : "-"}
                  </td>
                  {isOnderbouw && (
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
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
                  )}
                  <td className="px-4 py-2 text-right align-top" onClick={(e) => e.stopPropagation()}>
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
                    <td colSpan={colSpan} className="px-4 pb-3 pt-0">
                      {/* Evaluation status grid */}
                      <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 grid grid-cols-1 md:grid-cols-5 gap-3 text-[11px] text-gray-700">
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">Opdrachtgever</div>
                          <div className="flex items-center gap-1">
                            {renderStatusIndicator(
                              project.client_organization ? "complete" : "not_started"
                            )}
                            {project.client_organization || "Geen opdrachtgever"}
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">Projectbeoordeling</div>
                          <Link 
                            href={`/teacher/project-assessments?project_id=${project.project_id}`}
                            className="flex items-center gap-1 hover:underline"
                          >
                            {renderStatusIndicator(
                              (project.evaluation_counts?.project_assessment || 0) > 0 ? "complete" : "not_started"
                            )}
                            {(project.evaluation_counts?.project_assessment || 0) > 0 
                              ? `${project.evaluation_counts?.project_assessment} beoordeling${(project.evaluation_counts?.project_assessment || 0) > 1 ? "en" : ""} gekoppeld`
                              : "Nog geen beoordeling"
                            }
                          </Link>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">Peerevaluatie</div>
                          <Link 
                            href={`/teacher/evaluations?project_id=${project.project_id}`}
                            className="flex items-center gap-1 hover:underline"
                          >
                            {renderStatusIndicator(
                              (project.evaluation_counts?.peer || 0) > 0 ? "complete" : "not_started"
                            )}
                            {(project.evaluation_counts?.peer || 0) > 0 
                              ? `${project.evaluation_counts?.peer} peerevaluatie${(project.evaluation_counts?.peer || 0) > 1 ? "s" : ""} ingericht`
                              : "Nog geen peerevaluatie"
                            }
                          </Link>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">Competentiescan</div>
                          <Link 
                            href={`/teacher/competencies?project_id=${project.project_id}`}
                            className="flex items-center gap-1 hover:underline"
                          >
                            {renderStatusIndicator(
                              (project.evaluation_counts?.competency_scan || 0) > 0 ? "complete" : "not_started"
                            )}
                            {(project.evaluation_counts?.competency_scan || 0) > 0 
                              ? `${project.evaluation_counts?.competency_scan} scan${(project.evaluation_counts?.competency_scan || 0) > 1 ? "s" : ""} ingericht`
                              : "Scan nog in te richten"
                            }
                          </Link>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">Aantekeningen</div>
                          <Link href={`/teacher/project-notes?project_id=${project.project_id}`} className="hover:underline">
                            {(project.note_count || 0) > 0 
                              ? <><span className="font-medium">{project.note_count}</span> aantekening{(project.note_count || 0) > 1 ? "en" : ""} • <span className="underline underline-offset-2">Bekijk overzicht</span></>
                              : "Nog geen aantekeningen"
                            }
                          </Link>
                        </div>
                      </div>
                      
                      {/* Deelprojecten section for Bovenbouw projects */}
                      {!isOnderbouw && (
                        <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <h3 className="text-xs font-semibold text-gray-800">
                                Deelprojecten – {project.project_title}
                              </h3>
                              <p className="text-[11px] text-gray-500">
                                Per deelproject zie je de opdrachtgever, het team en de namen van de teamleden.
                              </p>
                            </div>
                            <button 
                              className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                              onClick={() => onAddSubproject(project)}
                            >
                              + Nieuw deelproject
                            </button>
                          </div>

                          {/* Subprojects table */}
                          <div className="overflow-x-auto text-xs">
                            <table className="min-w-full text-left">
                              <thead>
                                <tr className="border-b border-blue-100 text-[11px] text-gray-500">
                                  <th className="py-2 pr-4">Deelproject</th>
                                  <th className="px-4 py-2">Opdrachtgever</th>
                                  <th className="px-4 py-2">Team</th>
                                  <th className="px-4 py-2">Teamleden</th>
                                  <th className="px-4 py-2 text-right">Mail</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-blue-100">
                                {project.subprojects && project.subprojects.length > 0 ? (
                                  project.subprojects.map((subproject) => (
                                    <tr key={subproject.id} className="hover:bg-white/80">
                                      <td className="py-2 pr-4 align-top">{subproject.title}</td>
                                      <td className="px-4 py-2 align-top">{subproject.client_name || "-"}</td>
                                      <td className="px-4 py-2 align-top">{subproject.team_name || "-"}</td>
                                      <td className="px-4 py-2 align-top text-[11px] text-gray-700">
                                        {subproject.team_members?.join(", ") || "-"}
                                      </td>
                                      <td className="px-4 py-2 align-top text-right">
                                        {subproject.client_email ? (
                                          <a
                                            href={`mailto:${subproject.client_email}?subject=Deelproject: ${encodeURIComponent(subproject.title)}`}
                                            className="inline-flex items-center px-3 py-1.5 text-[11px] font-medium text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-50"
                                          >
                                            📧 Mail
                                          </a>
                                        ) : (
                                          <span className="text-slate-400 text-[11px]">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={5} className="py-4 text-center text-gray-500 text-[11px]">
                                      Nog geen deelprojecten aangemaakt. Klik op &quot;+ Nieuw deelproject&quot; om te beginnen.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      
                      {/* Team members if available (for onderbouw) */}
                      {isOnderbouw && project.student_names && project.student_names.length > 0 && (
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
                <td colSpan={colSpan} className="px-4 py-8 text-center text-gray-500">
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
  
  // Subproject modal
  const [subprojectModalProject, setSubprojectModalProject] = useState<ProjectWithLevel | null>(null);
  const [isCreatingSubproject, setIsCreatingSubproject] = useState(false);

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

  // Refresh key to trigger re-fetch when returning from wizard
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch projects - using listProjects to get ALL projects, then enrich with details
  useEffect(() => {
    async function fetchProjects() {
      try {
        setLoading(true);
        // Use listProjects to get all projects, including newly created ones
        const response = await projectService.listProjects({ per_page: 100 });
        
        // Map ProjectListItem to ProjectWithLevel format
        const basicProjects: ProjectWithLevel[] = (response.items || []).map(item => {
          // Find course info
          const course = courses.find(c => c.id === item.course_id);
          
          return {
            project_id: item.id,
            project_title: item.title,
            project_status: item.status,
            course_name: course?.name,
            course_id: item.course_id,
            course_level: course?.level,
            class_name: item.class_name,
            start_date: item.start_date,
            end_date: item.end_date,
            student_names: [],
          };
        });
        
        // Fetch project details and subprojects in parallel
        const [projectDetails, subprojectsResults] = await Promise.all([
          Promise.allSettled(basicProjects.map(p => projectService.getProject(p.project_id))),
          Promise.allSettled(basicProjects.map(p => projectService.listSubprojects(p.project_id))),
        ]);
        
        // Enrich projects with details and subprojects
        const enrichedProjects: ProjectWithLevel[] = basicProjects.map((project, index) => {
          const detailResult = projectDetails[index];
          const subprojectsResult = subprojectsResults[index];
          
          let enriched = { ...project };
          
          if (detailResult.status === 'fulfilled') {
            const detail = detailResult.value;
            enriched = {
              ...enriched,
              evaluation_counts: detail.evaluation_counts,
              note_count: detail.note_count,
              client_count: detail.client_count,
              description: detail.description,
              // Add client info from project details
              client_id: detail.client_id,
              client_organization: detail.client_organization,
              client_email: detail.client_email,
            };
          }
          
          if (subprojectsResult.status === 'fulfilled') {
            enriched.subprojects = subprojectsResult.value.items;
          } else {
            enriched.subprojects = [];
          }
          
          return enriched;
        });
        
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
    
    // Only fetch when courses are loaded
    if (courses.length > 0) {
      fetchProjects();
    }
  }, [courses, refreshKey]);

  // Auto-refresh with debounce when the component becomes visible (e.g., returning from wizard)
  useEffect(() => {
    let lastRefreshTime = 0;
    const DEBOUNCE_MS = 2000; // Only refresh if more than 2 seconds since last refresh
    
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastRefreshTime > DEBOUNCE_MS) {
        lastRefreshTime = now;
        setRefreshKey(prev => prev + 1);
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

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

  const handleEditProject = async (data: { 
    title: string; 
    class_name?: string; 
    status: string;
    course_id?: number;
    start_date?: string;
    end_date?: string;
    description?: string;
    client_ids?: number[];
  }) => {
    if (!editingProject) return;
    
    setIsSaving(true);
    try {
      // Update project basic fields
      await projectService.updateProject(editingProject.project_id, {
        title: data.title,
        class_name: data.class_name,
        status: data.status,
        course_id: data.course_id,
        start_date: data.start_date,
        end_date: data.end_date,
        description: data.description,
      });
      
      // Handle client linking/unlinking
      if (data.client_ids !== undefined) {
        const currentClientId = editingProject.client_id;
        const newClientIds = data.client_ids;
        
        // Unlink old client if it's no longer selected
        if (currentClientId && !newClientIds.includes(currentClientId)) {
          try {
            await clientService.unlinkProjectFromClient(currentClientId, editingProject.project_id);
          } catch (err) {
            console.warn("Failed to unlink old client:", err);
          }
        }
        
        // Link new clients (ignore "already linked" errors - 400 status)
        for (const clientId of newClientIds) {
          if (clientId !== currentClientId) {
            try {
              await clientService.linkProjectToClient(clientId, editingProject.project_id);
            } catch (err: unknown) {
              // Ignore 400 errors (project already linked to this client)
              const axiosErr = err as { response?: { status?: number } };
              if (axiosErr.response?.status !== 400) {
                console.warn("Failed to link client:", err);
              }
            }
          }
        }
      }
      
      // Find course name for the selected course_id
      const selectedCourse = courses.find(c => c.id === data.course_id);
      
      // Update local state
      setProjects(prev => prev.map(p => 
        p.project_id === editingProject.project_id 
          ? { 
              ...p, 
              project_title: data.title, 
              class_name: data.class_name, 
              project_status: data.status,
              course_name: selectedCourse?.name,
              course_level: selectedCourse?.level,
              start_date: data.start_date,
              end_date: data.end_date,
              description: data.description,
              client_id: data.client_ids?.[0],
            }
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
        courses={courses}
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
        onAddSubproject={setSubprojectModalProject}
      />
      
      {/* Subproject Modal for bovenbouw */}
      <SubprojectModal
        isOpen={subprojectModalProject !== null}
        projectTitle={subprojectModalProject?.project_title || ""}
        courseId={subprojectModalProject?.course_id}
        onSave={async (subprojectData) => {
          if (subprojectModalProject) {
            setIsCreatingSubproject(true);
            try {
              // Create subproject via API
              const newSubproject = await projectService.createSubproject(
                subprojectModalProject.project_id,
                {
                  title: subprojectData.title,
                  client_id: subprojectData.client_id,
                  team_number: subprojectData.team_number,
                }
              );
              
              // Update the project in the projects list with the new subproject
              setProjects(prev => {
                const updated = prev.map(p => {
                  if (p.project_id === subprojectModalProject.project_id) {
                    return {
                      ...p,
                      subprojects: [...(p.subprojects || []), newSubproject],
                    };
                  }
                  return p;
                });
                return updated;
              });
              
              setSubprojectModalProject(null);
            } catch (err) {
              console.error("Failed to create subproject:", err);
              alert("Kon deelproject niet aanmaken");
            } finally {
              setIsCreatingSubproject(false);
            }
          }
        }}
        onCancel={() => setSubprojectModalProject(null)}
        isSaving={isCreatingSubproject}
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
