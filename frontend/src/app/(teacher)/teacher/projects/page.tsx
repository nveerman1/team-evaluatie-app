"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Tabs } from "@/components/Tabs";
import { projectService } from "@/services/project.service";
import { Loading } from "@/components";

// Types for projects
interface SubProject {
  id: number;
  name: string;
  client: string;
  clientEmail?: string;
  team: string;
  teamMembers: string[];
}

interface Project {
  id: number;
  title: string;
  description: string;
  courseName: string;
  clientOrganization: string;
  clientContact?: string;
  clientEmail?: string;
  period: string;
  startDate?: string;
  endDate?: string;
  isChoiceProject?: boolean;
  subProjects?: SubProject[];
  evaluation?: {
    id?: number;
    status: "complete" | "partial" | "not_started";
    count?: number;
  };
  peerEvaluation?: {
    id?: number;
    status: "complete" | "partial" | "not_started";
    count?: number;
  };
  competencyScan?: {
    id?: number;
    status: "complete" | "partial" | "not_started";
  };
  notes?: {
    count: number;
  };
}

// Mail templates
const MAIL_TEMPLATES = [
  { value: "opvolgmail", label: "Opvolgmail" },
  { value: "startproject", label: "Startproject uitnodiging" },
  { value: "tussenpresentatie", label: "Tussenpresentatie uitnodiging" },
  { value: "eindpresentatie", label: "Eindpresentatie uitnodiging" },
  { value: "bedankmail", label: "Bedankmail" },
];

// Render status indicator
const renderStatusIndicator = (status: "complete" | "partial" | "not_started") => {
  const colors = {
    complete: "bg-green-400",
    partial: "bg-yellow-400",
    not_started: "bg-gray-300",
  };
  return <span className={`h-2 w-2 rounded-full ${colors[status]}`} />;
};

// Project Table Component
function ProjectTable({ 
  projects, 
  selectedProjects, 
  toggleProjectSelection, 
  toggleAllProjects, 
  expandedProjects, 
  toggleProjectExpansion,
  isOnderbouw 
}: {
  projects: Project[];
  selectedProjects: number[];
  toggleProjectSelection: (id: number) => void;
  toggleAllProjects: () => void;
  expandedProjects: number[];
  toggleProjectExpansion: (id: number) => void;
  isOnderbouw: boolean;
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
              : <>Keuzeprojecten met centrale beoordeling, peer en scan. Klik op een keuzeproject om de deelprojecten met teams en opdrachtgevers te zien.</>
            }
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span>Sorteren op</span>
          <select className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
            <option>{isOnderbouw ? "Startdatum" : "Course (Vak)"}</option>
            <option>Course (Vak)</option>
            <option>Projectnaam</option>
            {!isOnderbouw && <option>Periode</option>}
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
              <th className="py-2 pr-4">{isOnderbouw ? "Project" : "Keuzeproject"}</th>
              <th className="px-4 py-2">Course (Vak)</th>
              <th className="px-4 py-2">{isOnderbouw ? "Opdrachtgever" : "Opdrachtgever(s)"}</th>
              <th className="px-4 py-2">Periode</th>
              <th className="px-4 py-2">Mail opdrachtgever</th>
              <th className="px-4 py-2 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {projects.map((project) => (
              <React.Fragment key={project.id}>
                {/* Main project row */}
                <tr className="hover:bg-gray-50 align-top">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedProjects.includes(project.id)}
                      onChange={() => toggleProjectSelection(project.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-gray-900">{project.title}</span>
                      <span className="text-[11px] text-gray-500">{project.description}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-[11px] text-gray-700">{project.courseName}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-800">{project.clientOrganization}</span>
                      {project.clientContact && (
                        <span className="text-[11px] text-gray-400">
                          {project.isChoiceProject ? project.clientContact : `Contact: ${project.clientContact}`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-[11px] text-gray-600">{project.period}</td>
                  <td className="px-4 py-2">
                    {project.clientEmail ? (
                      <a
                        href={`mailto:${project.clientEmail}?subject=Project: ${encodeURIComponent(project.title)}`}
                        className="inline-flex items-center px-3 py-1.5 text-[11px] font-medium text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-50"
                      >
                        📧 Mail
                      </a>
                    ) : (
                      <button className="inline-flex items-center px-3 py-1.5 text-[11px] font-medium text-slate-400 rounded-lg border border-slate-200 cursor-not-allowed">
                        📧 Mail
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right align-top">
                    <button
                      onClick={() => toggleProjectExpansion(project.id)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900"
                    >
                      Details
                      <span className="text-xs">{expandedProjects.includes(project.id) ? "▾" : "▸"}</span>
                    </button>
                  </td>
                </tr>

                {/* Expanded details row - shows for both onderbouw and bovenbouw */}
                {expandedProjects.includes(project.id) && (
                  <tr className="bg-gray-50/60">
                    <td colSpan={7} className="px-4 pb-3 pt-0">
                      <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px] text-gray-700">
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">Evaluatie</div>
                          <Link 
                            href={project.evaluation?.id ? `/teacher/project-assessments/${project.evaluation.id}` : `/teacher/project-assessments`}
                            className="flex items-center gap-1 hover:underline"
                          >
                            {renderStatusIndicator(project.evaluation?.status || "not_started")}
                            {project.evaluation?.status === "complete" && `${project.evaluation.count} beoordeling gekoppeld`}
                            {project.evaluation?.status === "partial" && `${project.evaluation.count} beoordeling deels ingevuld`}
                            {project.evaluation?.status === "not_started" && "Nog geen beoordeling"}
                          </Link>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">Peerevaluatie</div>
                          <Link 
                            href={project.peerEvaluation?.id ? `/teacher/evaluations/${project.peerEvaluation.id}` : `/teacher/evaluations`}
                            className="flex items-center gap-1 hover:underline"
                          >
                            {renderStatusIndicator(project.peerEvaluation?.status || "not_started")}
                            {project.peerEvaluation?.status === "complete" && `${project.peerEvaluation.count} peerevaluatie(s) afgerond`}
                            {project.peerEvaluation?.status === "partial" && `${project.peerEvaluation.count} peerevaluatie ingericht`}
                            {project.peerEvaluation?.status === "not_started" && "Nog niet ingericht"}
                          </Link>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">Competentiescan</div>
                          <Link 
                            href={project.competencyScan?.id ? `/teacher/competencies/${project.competencyScan.id}` : `/teacher/competencies`}
                            className="flex items-center gap-1 hover:underline"
                          >
                            {renderStatusIndicator(project.competencyScan?.status || "not_started")}
                            {project.competencyScan?.status === "complete" && "Scan afgerond"}
                            {project.competencyScan?.status === "partial" && "Scan deels ingevuld"}
                            {project.competencyScan?.status === "not_started" && "Scan nog in te richten"}
                          </Link>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">Aantekeningen</div>
                          <Link href={`/teacher/project-notes/${project.id}`} className="hover:underline">
                            {project.notes?.count || 0} aantekeningen • Bekijk overzicht
                          </Link>
                        </div>
                      </div>

                      {/* Subprojects table for bovenbouw */}
                      {!isOnderbouw && project.isChoiceProject && (
                        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <h3 className="text-xs font-semibold text-gray-800">
                                Deelprojecten – {project.title}
                              </h3>
                              <p className="text-[11px] text-gray-500">
                                Per deelproject zie je de opdrachtgever, het team en de namen van de teamleden.
                              </p>
                            </div>
                            <button className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50">
                              + Nieuw deelproject
                            </button>
                          </div>

                          {project.subProjects && project.subProjects.length > 0 ? (
                            <div className="overflow-x-auto text-xs">
                              <table className="min-w-full text-left">
                                <thead>
                                  <tr className="border-b border-blue-100 text-[11px] text-gray-500">
                                    <th className="py-2 pr-4">Deelproject</th>
                                    <th className="px-4 py-2">Opdrachtgever</th>
                                    <th className="px-4 py-2">Team</th>
                                    <th className="px-4 py-2">Teamleden</th>
                                    <th className="px-4 py-2 text-right">Mail opdrachtgever</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-blue-100">
                                  {project.subProjects.map((subProject) => (
                                    <tr key={subProject.id} className="hover:bg-white/80">
                                      <td className="py-2 pr-4 align-top">{subProject.name}</td>
                                      <td className="px-4 py-2 align-top">{subProject.client}</td>
                                      <td className="px-4 py-2 align-top">{subProject.team}</td>
                                      <td className="px-4 py-2 align-top text-[11px] text-gray-700">
                                        {subProject.teamMembers.join(", ")}
                                      </td>
                                      <td className="px-4 py-2 align-top text-right">
                                        {subProject.clientEmail ? (
                                          <a
                                            href={`mailto:${subProject.clientEmail}?subject=Deelproject: ${encodeURIComponent(subProject.name)}`}
                                            className="inline-flex items-center px-3 py-1 text-[11px] font-medium text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-50"
                                          >
                                            📧 Mail
                                          </a>
                                        ) : (
                                          <button className="inline-flex items-center px-3 py-1 text-[11px] font-medium text-slate-400 rounded-lg border border-slate-200 cursor-not-allowed">
                                            📧 Mail
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-[11px] text-gray-500 italic py-2">
                              Nog geen deelprojecten aangemaakt.
                            </p>
                          )}
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

// Onderbouw Tab Content
function OnderbouwContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<number[]>([]);
  const [emailTemplate, setEmailTemplate] = useState("opvolgmail");
  const [availableCourses, setAvailableCourses] = useState<string[]>([]);

  useEffect(() => {
    async function fetchProjects() {
      try {
        setLoading(true);
        // Fetch projects from API - filter for onderbouw (non-choice projects)
        const response = await projectService.listProjects({ per_page: 100 });
        
        // Transform API data to our Project interface
        const transformedProjects: Project[] = (response.items || []).map(item => ({
          id: item.id,
          title: item.title,
          description: "",
          courseName: item.course_id ? `Course ${item.course_id}` : "Geen vak",
          clientOrganization: "Opdrachtgever",
          period: item.start_date && item.end_date 
            ? `${new Date(item.start_date).toLocaleDateString("nl-NL")} – ${new Date(item.end_date).toLocaleDateString("nl-NL")}`
            : "Geen periode",
          startDate: item.start_date,
          endDate: item.end_date,
          isChoiceProject: false,
          evaluation: { status: "not_started" as const },
          peerEvaluation: { status: "not_started" as const },
          competencyScan: { status: "not_started" as const },
          notes: { count: 0 },
        }));

        setProjects(transformedProjects);
        
        // Extract unique courses
        const courses = Array.from(new Set(transformedProjects.map(p => p.courseName).filter(Boolean)));
        setAvailableCourses(courses);
      } catch (err) {
        console.error("Failed to fetch projects:", err);
        setError("Kon projecten niet laden");
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  // Filter projects
  const filteredProjects = projects.filter(project => {
    const matchesSearch = searchQuery === "" || 
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.courseName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = courseFilter === "" || project.courseName.includes(courseFilter);
    const matchesStatus = statusFilter === "" || true; // TODO: implement status filter
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
      setSelectedProjects(filteredProjects.map(p => p.id));
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
    setPeriodFilter("");
  };

  const handleSendBulkEmail = () => {
    const selectedEmails = filteredProjects
      .filter(p => selectedProjects.includes(p.id) && p.clientEmail)
      .map(p => p.clientEmail)
      .filter((email): email is string => !!email)
      .join(";");
    
    if (!selectedEmails) {
      alert("Geen opdrachtgevers met email geselecteerd");
      return;
    }
    
    const template = MAIL_TEMPLATES.find(t => t.value === emailTemplate);
    const subject = encodeURIComponent(template?.label || "Project update");
    const body = encodeURIComponent("Beste opdrachtgever,\n\n\n\nMet vriendelijke groet,\nHet docententeam");
    
    window.open(`mailto:${selectedEmails}?subject=${subject}&body=${body}`, '_self');
  };

  const selectedWithEmail = filteredProjects.filter(
    p => selectedProjects.includes(p.id) && p.clientEmail
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
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
        <input
          type="text"
          placeholder="Zoek op titel, Course (Vak)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2 rounded-lg border w-64 text-sm"
        />
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
        >
          <option value="">Alle Courses (Vakken)</option>
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
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
        >
          <option value="">Alle periodes</option>
          <option value="1">Periode 1</option>
          <option value="2">Periode 2</option>
          <option value="3">Periode 3</option>
          <option value="4">Periode 4</option>
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
              >
                {MAIL_TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
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
        isOnderbouw={true}
      />
    </div>
  );
}

// Bovenbouw Tab Content
function BovenbouwContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<number[]>([]);
  const [emailTemplate, setEmailTemplate] = useState("opvolgmail");
  const [availableCourses, setAvailableCourses] = useState<string[]>([]);

  useEffect(() => {
    async function fetchProjects() {
      try {
        setLoading(true);
        // Fetch projects from API - filter for bovenbouw (choice projects)
        const response = await projectService.listProjects({ per_page: 100 });
        
        // Transform API data to our Project interface - mark as choice projects for bovenbouw
        const transformedProjects: Project[] = (response.items || []).map(item => ({
          id: item.id,
          title: item.title,
          description: "",
          courseName: item.course_id ? `Course ${item.course_id}` : "Geen vak",
          clientOrganization: "Opdrachtgever(s)",
          period: item.start_date && item.end_date 
            ? `${new Date(item.start_date).toLocaleDateString("nl-NL")} – ${new Date(item.end_date).toLocaleDateString("nl-NL")}`
            : "Geen periode",
          startDate: item.start_date,
          endDate: item.end_date,
          isChoiceProject: true,
          subProjects: [], // Would be populated from API
          evaluation: { status: "not_started" as const },
          peerEvaluation: { status: "not_started" as const },
          competencyScan: { status: "not_started" as const },
          notes: { count: 0 },
        }));

        setProjects(transformedProjects);
        
        // Extract unique courses
        const courses = Array.from(new Set(transformedProjects.map(p => p.courseName).filter(Boolean)));
        setAvailableCourses(courses);
      } catch (err) {
        console.error("Failed to fetch projects:", err);
        setError("Kon projecten niet laden");
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  // Filter projects
  const filteredProjects = projects.filter(project => {
    const matchesSearch = searchQuery === "" || 
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.courseName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = courseFilter === "" || project.courseName.includes(courseFilter);
    const matchesStatus = statusFilter === "" || true; // TODO: implement status filter
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
      setSelectedProjects(filteredProjects.map(p => p.id));
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
    setPeriodFilter("");
  };

  const handleSendBulkEmail = () => {
    const selectedEmails = filteredProjects
      .filter(p => selectedProjects.includes(p.id) && p.clientEmail)
      .map(p => p.clientEmail)
      .filter((email): email is string => !!email)
      .join(";");
    
    if (!selectedEmails) {
      alert("Geen opdrachtgevers met email geselecteerd");
      return;
    }
    
    const template = MAIL_TEMPLATES.find(t => t.value === emailTemplate);
    const subject = encodeURIComponent(template?.label || "Project update");
    const body = encodeURIComponent("Beste opdrachtgever,\n\n\n\nMet vriendelijke groet,\nHet docententeam");
    
    window.open(`mailto:${selectedEmails}?subject=${subject}&body=${body}`, '_self');
  };

  const selectedWithEmail = filteredProjects.filter(
    p => selectedProjects.includes(p.id) && p.clientEmail
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
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
        <input
          type="text"
          placeholder="Zoek op titel, Course (Vak)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2 rounded-lg border w-64 text-sm"
        />
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
        >
          <option value="">Alle Courses (Vakken)</option>
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
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
        >
          <option value="">Alle periodes</option>
          <option value="1">Periode 1</option>
          <option value="2">Periode 2</option>
          <option value="3">Periode 3</option>
          <option value="4">Periode 4</option>
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
              >
                {MAIL_TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
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
        isOnderbouw={false}
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
      content: <OnderbouwContent />,
    },
    {
      id: "bovenbouw",
      label: "Bovenbouw",
      content: <BovenbouwContent />,
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
