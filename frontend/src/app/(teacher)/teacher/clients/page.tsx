"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ClientFormModal } from "@/components/clients/ClientFormModal";
import { ClientsList } from "@/components/clients/ClientsList";
import { clientService } from "@/services/client.service";

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

export default function ClientsPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "running" | "list" | "communication">("dashboard");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleClientCreated = () => {
    // Trigger a refresh by updating the key
    setRefreshKey(prev => prev + 1);
  };

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-slate-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
              Opdrachtgevers
            </h1>
            <p className="text-slate-600 mt-1 text-sm">
              Beheer contactgegevens, projecten en samenwerkingen met externe partners.
            </p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            + Nieuwe opdrachtgever
          </button>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Modal for creating new client */}
        <ClientFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleClientCreated}
        />

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "dashboard"
              ? "border-sky-500 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Inzicht &amp; relatie-health
        </button>
        <button
          onClick={() => setActiveTab("running")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "running"
              ? "border-sky-500 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Lopende Projecten
        </button>
        <button
          onClick={() => setActiveTab("list")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "list"
              ? "border-sky-500 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Lijst &amp; filters
        </button>
        <button
          onClick={() => setActiveTab("communication")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "communication"
              ? "border-sky-500 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Communicatie
        </button>
      </div>

        {/* Tab Content */}
        {activeTab === "dashboard" && <DashboardTab onNavigateToList={() => setActiveTab("list")} />}
        {activeTab === "running" && <RunningProjectsTab />}
        {activeTab === "list" && <ListTab refreshKey={refreshKey} />}
        {activeTab === "communication" && <CommunicationTab />}
      </div>
    </>
  );
}

// Tab 1: Dashboard - Inzicht & relatie-health
function DashboardTab({ onNavigateToList }: { onNavigateToList: () => void }) {
  const [kpiData, setKpiData] = useState<any>(null);
  const [newClients, setNewClients] = useState<any>(null);
  const [topCollaborations, setTopCollaborations] = useState<any>(null);
  const [atRiskClients, setAtRiskClients] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [kpi, newClientsData, topCollab, atRisk] = await Promise.all([
          clientService.getDashboardKPI(),
          clientService.getNewClients(3),
          clientService.getTopCollaborations(3),
          clientService.getAtRiskClients(3),
        ]);
        setKpiData(kpi);
        setNewClients(newClientsData);
        setTopCollaborations(topCollab);
        setAtRiskClients(atRisk);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("Er is een fout opgetreden bij het laden van de gegevens.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">Laden...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    );
  }

  const avgProjectsPerClient = kpiData?.active_clients > 0 
    ? (kpiData.projects_this_year / kpiData.active_clients).toFixed(1)
    : "0";

  return (
    <>
      {/* KPI Cards in one row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Actieve opdrachtgevers</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{kpiData?.active_clients || 0}</p>
          {kpiData?.change_from_last_year !== 0 && (
            <p className={`mt-1 text-[11px] ${kpiData?.change_from_last_year > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {kpiData?.change_from_last_year > 0 ? '+' : ''}{kpiData?.change_from_last_year} t.o.v. vorig jaar
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Projecten dit jaar</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{kpiData?.projects_this_year || 0}</p>
          <p className="mt-1 text-[11px] text-slate-500">Gem. {avgProjectsPerClient} per opdrachtgever</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Risico op afhaak</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{kpiData?.at_risk_count || 0}</p>
          <p className="mt-1 text-[11px] text-amber-600">&gt; 1 jaar geen project</p>
        </div>
      </div>

      {/* Insights in 3 columns */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Nieuwe opdrachtgevers */}
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-emerald-900 mb-3">
            ✨ Nieuwe opdrachtgevers
          </h3>
          <p className="text-xs text-slate-600 mb-3">Recent toegevoegde organisaties</p>
          <div className="space-y-2">
            {newClients?.items && newClients.items.length > 0 ? (
              newClients.items.map((client: any) => (
                <Link 
                  key={client.id} 
                  href={`/teacher/clients/${client.id}`}
                  className="flex items-center justify-between p-2 bg-white rounded-lg border border-emerald-100 hover:bg-emerald-50/50 transition-colors"
                >
                  <div>
                    <span className="text-sm text-slate-800 font-medium">{client.organization}</span>
                    {client.sector && <span className="text-xs text-slate-500 ml-2">· {client.sector}</span>}
                  </div>
                  <span className="text-xs text-slate-500">{client.created_at}</span>
                </Link>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-2">Geen nieuwe opdrachtgevers</p>
            )}
          </div>
          {newClients?.has_more && (
            <button 
              onClick={onNavigateToList}
              className="mt-3 w-full text-xs text-emerald-700 hover:text-emerald-800 font-medium"
            >
              Bekijk alle {newClients.total} opdrachtgevers →
            </button>
          )}
        </section>

        {/* Top-samenwerkingen */}
        <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-sky-900 mb-3">
            🏆 Top-samenwerkingen
          </h3>
          <p className="text-xs text-slate-600 mb-3">Organisaties met meeste projecten / jaren samenwerking</p>
          <div className="space-y-2">
            {topCollaborations?.items && topCollaborations.items.length > 0 ? (
              topCollaborations.items.map((client: any) => (
                <Link 
                  key={client.id}
                  href={`/teacher/clients/${client.id}`}
                  className="flex items-center justify-between p-2 bg-white rounded-lg border border-sky-100 hover:bg-sky-50/50 transition-colors"
                >
                  <div>
                    <span className="text-sm text-slate-800 font-medium">{client.organization}</span>
                    {client.years_active && <span className="text-xs text-slate-500 ml-2">· {client.years_active} jaar</span>}
                  </div>
                  <span className="text-xs font-medium text-sky-700">{client.project_count} projecten</span>
                </Link>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-2">Geen samenwerkingen gevonden</p>
            )}
          </div>
          {topCollaborations?.has_more && (
            <button 
              onClick={onNavigateToList}
              className="mt-3 w-full text-xs text-sky-700 hover:text-sky-800 font-medium"
            >
              Bekijk alle {topCollaborations.total} opdrachtgevers →
            </button>
          )}
        </section>

        {/* Risico op afhaak */}
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-amber-900 mb-3">
            ⚠️ Risico op afhaak
          </h3>
          <p className="text-xs text-slate-600 mb-3">Organisaties waarbij lastActive &gt; 1 jaar geleden</p>
          <div className="space-y-2">
            {atRiskClients?.items && atRiskClients.items.length > 0 ? (
              atRiskClients.items.map((client: any) => (
                <Link 
                  key={client.id}
                  href={`/teacher/clients/${client.id}`}
                  className="flex flex-col p-2 bg-white rounded-lg border border-amber-100 hover:bg-amber-50/50 transition-colors"
                >
                  <span className="text-sm text-slate-800 font-medium">{client.organization}</span>
                  <span className="text-xs text-slate-500">
                    Laatst: {client.last_active || "Nooit"}
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-2">Geen risico-opdrachtgevers</p>
            )}
          </div>
          {atRiskClients?.has_more && (
            <button 
              onClick={onNavigateToList}
              className="mt-3 w-full text-xs text-amber-700 hover:text-amber-800 font-medium"
            >
              Bekijk alle {atRiskClients.total} opdrachtgevers →
            </button>
          )}
        </section>
      </div>
    </>
  );
}

// Tab 2: Running Projects
function RunningProjectsTab() {
  const [projects, setProjects] = useState<{project_id: number; project_title: string; course_name?: string; client_organization?: string; client_email?: string; class_name?: string; team_number?: number; student_names: string[]; start_date?: string; end_date?: string; next_moment_type?: string; next_moment_date?: string; project_status: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [courseFilter, setCourseFilter] = useState<string>("Alle vakken");
  const [schoolYearFilter, setSchoolYearFilter] = useState<string>("2025–2026");
  const [searchFilter, setSearchFilter] = useState<string>("");
  
  // Sorting
  const [sortBy, setSortBy] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const perPage = 20;
  
  // Bulk email
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [emailTemplate, setEmailTemplate] = useState("opvolgmail");
  
  // Available courses for filter
  const [courses, setCourses] = useState<{id: number; name: string}[]>([]);
  
  useEffect(() => {
    async function fetchCourses() {
      try {
        const { courseService } = await import("@/services/course.service");
        const data = await courseService.listCourses({ per_page: 100 });
        setCourses(data.items || []);
      } catch (err) {
        console.error("Error fetching courses:", err);
      }
    }
    fetchCourses();
  }, []);
  
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const { projectService } = await import("@/services/project.service");
        
        // Fetch projects with filters
        const params: {
          page: number;
          per_page: number;
          search?: string;
          sort_by?: string;
          sort_order: "asc" | "desc";
          course_id?: number;
          school_year?: string;
        } = {
          page,
          per_page: perPage,
          search: searchFilter.trim() || undefined,
          sort_by: sortBy || undefined,
          sort_order: sortOrder,
        };
        
        if (courseFilter && courseFilter !== "Alle vakken") {
          const selectedCourse = courses.find(c => c.name === courseFilter);
          if (selectedCourse) {
            params.course_id = selectedCourse.id;
          }
        }
        
        if (schoolYearFilter && schoolYearFilter !== "Alle jaren") {
          params.school_year = schoolYearFilter;
        }
        
        const projectsData = await projectService.getRunningProjectsOverview(params);
        setProjects(projectsData.items || []);
        setTotal(projectsData.total || 0);
        setPages(projectsData.pages || 0);
      } catch (err) {
        console.error("Error fetching running projects data:", err);
        setError("Er is een fout opgetreden bij het laden van de gegevens.");
      } finally {
        setLoading(false);
      }
    }
    // Only fetch when courses are loaded and other dependencies change
    if (courses.length > 0 || courseFilter === "Alle vakken") {
      fetchData();
    }
  }, [page, courseFilter, schoolYearFilter, searchFilter, sortBy, sortOrder, courses]);
  
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };
  
  const handleExport = () => {
    // TODO: Implement export functionality
    alert("Export functionaliteit komt binnenkort beschikbaar");
  };
  
  const toggleProject = (projectId: number) => {
    if (selectedProjects.includes(projectId)) {
      setSelectedProjects(selectedProjects.filter(id => id !== projectId));
    } else {
      setSelectedProjects([...selectedProjects, projectId]);
    }
  };
  
  const toggleAll = () => {
    if (selectedProjects.length === projects.length) {
      setSelectedProjects([]);
    } else {
      setSelectedProjects(projects.map(p => p.project_id));
    }
  };
  
  const handleSendBulkEmail = () => {
    const selectedEmails = projects
      .filter(p => selectedProjects.includes(p.project_id) && p.client_email)
      .map(p => p.client_email)
      .filter((email): email is string => !!email)
      .join(";");
    
    if (!selectedEmails) {
      alert("Geen opdrachtgevers met email geselecteerd");
      return;
    }
    
    const templates: Record<string, { subject: string; body: string }> = {
      opvolgmail: {
        subject: `Samenwerking schooljaar ${schoolYearFilter}`,
        body: `Beste opdrachtgever,\n\nHet schooljaar ${schoolYearFilter} staat voor de deur en wij willen graag onze samenwerking voortzetten.\n\nHeeft u interesse om opnieuw een project met onze leerlingen te doen?\n\nMet vriendelijke groet,\nHet docententeam`,
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
    
    const selectedTemplate = templates[emailTemplate] || templates.opvolgmail;
    const mailtoLink = buildMailto({
      to: selectedEmails,
      subject: selectedTemplate.subject,
      body: selectedTemplate.body,
    });
    
    window.open(mailtoLink, '_self');
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">Laden...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    );
  }
  
  return (
    <>
      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Zoeken</label>
            <input 
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Zoek leerling, team of opdrachtgever…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Vak</label>
            <select 
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
            >
              <option>Alle vakken</option>
              {courses.map(course => (
                <option key={course.id} value={course.name}>{course.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Schooljaar</label>
            <select 
              value={schoolYearFilter}
              onChange={(e) => setSchoolYearFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
            >
              <option>2025–2026</option>
              <option>2024–2025</option>
              <option>2023–2024</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Bulk Email Section */}
      {selectedProjects.length > 0 && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">
                {selectedProjects.length} project{selectedProjects.length > 1 ? "en" : ""} geselecteerd
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {projects.filter(p => selectedProjects.includes(p.project_id) && p.client_email).length} opdrachtgever(s) met email
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={emailTemplate}
                onChange={(e) => setEmailTemplate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
              >
                <option value="opvolgmail">Opvolgmail</option>
                <option value="startproject">Startproject uitnodiging</option>
                <option value="tussenpresentatie">Tussenpresentatie uitnodiging</option>
                <option value="eindpresentatie">Eindpresentatie uitnodiging</option>
                <option value="bedankmail">Bedankmail</option>
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
      
      {/* Table Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">{total} lopende projecten</p>
        <button 
          onClick={handleExport}
          className="text-xs font-medium text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white"
        >
          Exporteer overzicht
        </button>
      </div>
      
      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={projects.length > 0 && selectedProjects.length === projects.length}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                </th>
                <th 
                  className="px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort("course")}
                >
                  <div className="flex items-center gap-1">
                    Vak
                    {sortBy === "course" && (
                      <span className="text-xs">{sortOrder === "asc" ? "▲" : "▼"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort("project")}
                >
                  <div className="flex items-center gap-1">
                    Project
                    {sortBy === "project" && (
                      <span className="text-xs">{sortOrder === "asc" ? "▲" : "▼"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort("client")}
                >
                  <div className="flex items-center gap-1">
                    Opdrachtgever
                    {sortBy === "client" && (
                      <span className="text-xs">{sortOrder === "asc" ? "▲" : "▼"}</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Team &amp; Leerlingen
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Periode
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Mail opdrachtgever
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Laden...
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Geen lopende projecten gevonden
                  </td>
                </tr>
              ) : (
                projects.map((project, idx) => (
                  <tr key={project.project_id} className={idx % 2 === 1 ? "bg-slate-50/50" : ""}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedProjects.includes(project.project_id)}
                        onChange={() => toggleProject(project.project_id)}
                        className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {project.course_name || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{project.project_title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{project.project_status}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {project.client_organization || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">
                        {project.class_name || "-"}
                        {project.team_number && ` · Team ${project.team_number}`}
                      </div>
                      {project.student_names && project.student_names.length > 0 && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">
                          {project.student_names.join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {project.start_date && project.end_date ? (
                        <>
                          {new Date(project.start_date).toLocaleDateString("nl-NL", { month: "short", year: "numeric" })} – {new Date(project.end_date).toLocaleDateString("nl-NL", { month: "short", year: "numeric" })}
                        </>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {project.client_email ? (
                        <a
                          href={`mailto:${project.client_email}?subject=Project: ${encodeURIComponent(project.project_title)}`}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-50"
                        >
                          📧 Mail
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Vorige
          </button>
          <span className="text-sm text-slate-600">
            Pagina {page} van {pages}
          </span>
          <button
            onClick={() => setPage(Math.min(pages, page + 1))}
            disabled={page === pages}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Volgende
          </button>
        </div>
      )}
    </>
  );
}

// Tab 3: List & filters
function ListTab({ refreshKey }: { refreshKey?: number }) {
  return <ClientsList refreshKey={refreshKey} />;
}


// Tab 4: Communication
function CommunicationTab() {
  const [schoolYear, setSchoolYear] = useState("2025–2026");
  const [level, setLevel] = useState("Alle");
  const [template, setTemplate] = useState("opvolgmail");
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  // Fetch all clients
  useEffect(() => {
    async function fetchClients() {
      try {
        setClientsLoading(true);
        const data = await clientService.listClients({ per_page: 100 });
        setAllClients(data.items);
      } catch (err) {
        console.error("Error fetching clients:", err);
      } finally {
        setClientsLoading(false);
      }
    }
    fetchClients();
  }, []);

  // Filter clients based on criteria
  // For simplicity, we'll show all active clients that can be filtered by level
  const filteredClients = allClients.filter(client => {
    if (!client.active) return false;
    if (level !== "Alle" && client.level !== level) return false;
    return true;
  });

  const toggleClient = (clientId: number) => {
    if (selectedClients.includes(clientId)) {
      setSelectedClients(selectedClients.filter(id => id !== clientId));
    } else {
      setSelectedClients([...selectedClients, clientId]);
    }
  };

  const toggleAll = () => {
    if (selectedClients.length === filteredClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(filteredClients.map(c => c.id));
    }
  };

  const handleSendBulkEmail = () => {
    const selectedEmails = filteredClients
      .filter(c => selectedClients.includes(c.id))
      .map(c => c.email)
      .join(";");

    const templates: Record<string, { subject: string; body: string }> = {
      opvolgmail: {
        subject: `Samenwerking schooljaar ${schoolYear}`,
        body: `Beste opdrachtgever,\n\nHet schooljaar ${schoolYear} staat voor de deur en wij willen graag onze samenwerking voortzetten.\n\nHeeft u interesse om opnieuw een project met onze leerlingen te doen?\n\nMet vriendelijke groet,\nHet docententeam`,
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

    const selectedTemplate = templates[template] || templates.opvolgmail;
    const mailtoLink = buildMailto({
      to: selectedEmails,
      subject: selectedTemplate.subject,
      body: selectedTemplate.body,
    });

    window.open(mailtoLink, '_self');
  };

  // Fetch recent communications
  const [recentCommunications, setRecentCommunications] = useState<any[]>([]);
  const [communicationsLoading, setCommunicationsLoading] = useState(true);

  useEffect(() => {
    async function fetchCommunications() {
      try {
        setCommunicationsLoading(true);
        const data = await clientService.getRecentCommunications(3);
        setRecentCommunications(data.items);
      } catch (err) {
        console.error("Error fetching communications:", err);
      } finally {
        setCommunicationsLoading(false);
      }
    }
    fetchCommunications();
  }, []);

  return (
    <>
      {/* Mail selection block */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Mail naar opdrachtgevers</h2>
          <p className="text-sm text-slate-600 mt-1">
            Kies schooljaar, niveau en een template om meerdere opdrachtgevers tegelijk te mailen.
          </p>
        </div>

        {/* Filter row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Schooljaar</label>
            <select 
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
            >
              <option>2025–2026</option>
              <option>2024–2025</option>
              <option>2023–2024</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Niveau</label>
            <select 
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
            >
              <option>Alle</option>
              <option>Onderbouw</option>
              <option>Bovenbouw</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Template</label>
            <select 
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
            >
              <option value="opvolgmail">Opvolgmail volgend schooljaar</option>
              <option value="startproject">Startproject-mail</option>
              <option value="tussenpresentatie">Uitnodiging tussenpresentatie</option>
              <option value="eindpresentatie">Uitnodiging eindpresentatie</option>
              <option value="bedankmail">Bedankmail</option>
            </select>
          </div>
        </div>

        {/* Client selection list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">
              Opdrachtgevers ({filteredClients.length} gevonden)
            </label>
            <button 
              onClick={toggleAll}
              className="text-xs text-sky-600 hover:text-sky-700 font-medium"
            >
              {selectedClients.length === filteredClients.length ? "Deselecteer alles" : "Selecteer alles"}
            </button>
          </div>

          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {clientsLoading ? (
              <div className="p-4 text-center text-slate-500 text-sm">
                Laden...
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">
                Geen opdrachtgevers gevonden die aan de criteria voldoen.
              </div>
            ) : (
              filteredClients.map((client) => (
                <label 
                  key={client.id}
                  className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedClients.includes(client.id)}
                    onChange={() => toggleClient(client.id)}
                    className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">{client.organization}</div>
                    <div className="text-xs text-slate-500">{client.email || 'Geen email'}</div>
                  </div>
                  <div className="text-xs text-slate-500">{client.level || 'N/A'}</div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
          <button 
            onClick={handleSendBulkEmail}
            disabled={selectedClients.length === 0}
            className={`w-full rounded-lg px-4 py-3 text-sm font-semibold shadow-sm ${
              selectedClients.length > 0
                ? 'bg-sky-600 text-white hover:bg-sky-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            📧 Open mail in Outlook voor geselecteerde opdrachtgevers ({selectedClients.length})
          </button>
        </div>
      </section>

      {/* Recent communications */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Laatste communicatie</h2>
        {communicationsLoading ? (
          <div className="text-center py-8 text-slate-500">Laden...</div>
        ) : recentCommunications.length > 0 ? (
          <div className="space-y-3">
            {recentCommunications.map((comm) => (
              <div 
                key={comm.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">{comm.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {comm.organization} · {comm.date}
                  </div>
                </div>
                <Link
                  href={`/teacher/clients/${comm.client_id}`}
                  className="text-xs font-medium text-sky-600 hover:text-sky-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white"
                >
                  Opdrachtgever openen
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">Nog geen communicatie gelogd</div>
        )}
      </section>
    </>
  );
}
