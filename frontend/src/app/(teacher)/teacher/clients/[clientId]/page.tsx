"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useClient, useClientLogs } from "@/hooks/useClients";
import { ClientEditModal } from "@/components/clients/ClientEditModal";
import { AddNoteModal } from "@/components/clients/AddNoteModal";
import { clientService, projectService } from "@/services";

// Helper function for building mailto links
function buildMailto({ to, subject, body }: { to: string; subject: string; body: string }) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = parseInt(params.clientId as string);
  
  const [activeTab, setActiveTab] = useState<"logboek" | "projecten" | "documenten" | "communicatie">("logboek");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: client, loading, error } = useClient(clientId);
  const { data: logsData, refetch: refetchLogs } = useClientLogs(clientId);

  const handleEditSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleNoteSuccess = () => {
    refetchLogs();
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="text-center py-8">Laden...</div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Fout bij laden van opdrachtgever
        </div>
      </div>
    );
  }

  const c = client;

  const statusBadgeClasses = c.active
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-12 pt-8">
      {/* Breadcrumbs */}
      <nav className="text-xs text-slate-500">
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/teacher/clients" className="hover:underline">
              Opdrachtgevers
            </Link>
          </li>
          <li className="text-slate-400">/</li>
          <li className="font-medium text-slate-600">{c.organization}</li>
        </ol>
      </nav>

      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {c.organization}
            </h1>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusBadgeClasses}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
              {c.active ? "Actief" : "Inactief"}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {c.sector} · {c.level}
          </p>
          <p className="text-xs text-slate-500">
            {c.contact_name} · {c.email}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Bewerken
          </button>
          <button
            onClick={async () => {
              if (confirm(`Weet je zeker dat je ${c.organization} wilt ${c.active ? 'archiveren' : 'activeren'}?`)) {
                try {
                  await clientService.updateClient(client.id, { active: !c.active });
                  setRefreshKey(prev => prev + 1);
                } catch (err) {
                  alert('Fout bij bijwerken van status');
                }
              }
            }}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {c.active ? 'Verplaats naar archief' : 'Activeer'}
          </button>
          <button
            onClick={() => setIsNoteModalOpen(true)}
            className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            + Nieuwe notitie
          </button>
        </div>

        {/* Modals */}
        {client && (
          <>
            <ClientEditModal
              isOpen={isEditModalOpen}
              onClose={() => setIsEditModalOpen(false)}
              onSuccess={handleEditSuccess}
              client={client}
            />
            <AddNoteModal
              isOpen={isNoteModalOpen}
              onClose={() => setIsNoteModalOpen(false)}
              onSuccess={handleNoteSuccess}
              clientId={client.id}
            />
          </>
        )}
      </header>

      {/* Bovenrij: Contact + Samenwerkingsoverzicht */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Contactkaart */}
        <div className="flex flex-col justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Contact</h2>
          </div>
          <dl className="space-y-2 text-sm text-slate-700">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Contactpersoon</dt>
              <dd className="font-medium text-slate-900">{c.contact_name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">E-mail</dt>
              <dd className="font-medium text-slate-900">{c.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Niveau</dt>
              <dd className="text-slate-900">{c.level}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Sector</dt>
              <dd className="text-slate-900">{c.sector}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => window.open(buildMailto({ to: c.email || "", subject: "", body: "" }), '_self')}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100"
            >
              Mail openen
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(c.email || "")}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Kopieer contact
            </button>
          </div>
        </div>

        {/* Samenwerking */}
        <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Overzicht samenwerking</h2>
          <p className="mt-1 text-xs text-slate-500">
            Samenvatting van alle projecten en samenwerking met deze opdrachtgever.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <KpiCard
              label="Projecten totaal"
              value="5"
              sublabel="Sinds start samenwerking"
            />
            <KpiCard
              label="Laatste jaar actief"
              value="2024–2025"
            />
            <KpiCard
              label="Relatiestatus"
              value="Stevige samenwerking"
              highlight
            />
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 px-4 pt-3">
          <nav className="flex flex-wrap gap-2 text-sm font-medium text-slate-500">
            {[
              { key: "logboek" as const, label: "Logboek" },
              { key: "projecten" as const, label: "Projecten" },
              { key: "documenten" as const, label: "Documenten" },
              { key: "communicatie" as const, label: "Communicatie" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-t-xl px-3 py-2 transition ${
                  activeTab === tab.key
                    ? "border-b-2 border-indigo-500 text-slate-900"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="px-4 pb-4 pt-3">
          {activeTab === "logboek" && <LogboekTab logs={logsData?.items || []} onAddNote={() => setIsNoteModalOpen(true)} />}
          {activeTab === "projecten" && <ProjectenTab clientId={clientId} />}
          {activeTab === "documenten" && <DocumentenTab />}
          {activeTab === "communicatie" && <CommunicatieTab client={client} />}
        </div>
      </section>
    </div>
  );
}

// KPI Card component
function KpiCard({
  label,
  value,
  sublabel,
  highlight,
}: {
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col justify-between rounded-2xl px-4 py-3 shadow-sm ring-1 ${
        highlight
          ? "bg-emerald-50 ring-emerald-100"
          : "bg-slate-50 ring-slate-200"
      }`}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-base font-semibold text-slate-900 line-clamp-2">{value}</span>
      </div>
      {sublabel && <span className="mt-1 text-[11px] text-slate-500">{sublabel}</span>}
    </div>
  );
}

// TAB: Logboek
function LogboekTab({ logs, onAddNote }: { logs: any[], onAddNote: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Contactmomenten & notities</h3>
          <p className="text-xs text-slate-500">
            Houd bij welke afspraken, mails en opmerkingen er zijn bij deze opdrachtgever.
          </p>
        </div>
        <button
          onClick={onAddNote}
          className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          + Notitie toevoegen
        </button>
      </div>
      <ul className="space-y-3 text-sm">
        {logs.length === 0 ? (
          <li className="rounded-xl bg-slate-50 px-3 py-2 shadow-sm ring-1 ring-slate-100 text-center text-slate-500">
            Geen notities gevonden.
          </li>
        ) : (
          logs.map((item) => (
            <li
              key={item.id}
              className="rounded-xl bg-slate-50 px-3 py-2 shadow-sm ring-1 ring-slate-100"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">
                  {new Date(item.created_at).toLocaleDateString('nl-NL')}
                </p>
                <p className="text-[11px] text-slate-400">
                  {item.log_type} · {item.author_name || 'Docent'}
                </p>
              </div>
              <p className="mt-1 text-sm text-slate-900">{item.text}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

// TAB: Projecten
function ProjectenTab({ clientId }: { clientId: number }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [linkingProject, setLinkingProject] = useState(false);

  // Fetch linked projects
  useEffect(() => {
    loadProjects();
  }, [clientId]);

  async function loadProjects() {
    try {
      setLoading(true);
      const response = await clientService.getClientProjects(clientId);
      setProjects(response.items || []);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAllProjects() {
    try {
      const response = await projectService.listProjects({ per_page: 100 });
      setAllProjects(response.items || []);
    } catch (err) {
      console.error("Failed to load all projects:", err);
    }
  }

  async function handleLinkProject() {
    if (!selectedProjectId) return;
    
    try {
      setLinkingProject(true);
      await clientService.linkProjectToClient(clientId, selectedProjectId);
      await loadProjects();
      setShowLinkModal(false);
      setSelectedProjectId(null);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || "Fout bij koppelen van project";
      alert(errorMessage);
    } finally {
      setLinkingProject(false);
    }
  }

  async function handleUnlinkProject(projectId: number) {
    if (!confirm("Weet je zeker dat je dit project wilt ontkoppelen?")) return;

    try {
      await clientService.unlinkProjectFromClient(clientId, projectId);
      await loadProjects();
    } catch (err) {
      alert("Fout bij ontkoppelen van project");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Projecten met deze opdrachtgever</h3>
          <p className="text-xs text-slate-500">
            Overzicht van alle projecten waaraan deze opdrachtgever heeft meegewerkt.
          </p>
        </div>
        <button
          onClick={() => {
            loadAllProjects();
            setShowLinkModal(true);
          }}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          + Nieuw project koppelen
        </button>
      </div>

      {/* Kleine samenvatting */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Projecten totaal" value={String(projects.length)} />
        <KpiCard label="Actieve schooljaren" value="2" />
        <KpiCard label="Laatst actief" value="2024–2025" />
      </div>

      {loading ? (
        <div className="text-center py-8 text-sm text-slate-500">Laden...</div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl bg-slate-50 px-3 py-8 text-center shadow-sm ring-1 ring-slate-100">
          <p className="text-sm text-slate-500">Nog geen projecten gekoppeld</p>
          <button
            onClick={() => {
              loadAllProjects();
              setShowLinkModal(true);
            }}
            className="mt-2 text-xs text-indigo-600 hover:text-indigo-700"
          >
            Koppel je eerste project
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Project</th>
                <th className="px-4 py-3 text-left font-medium">Rol</th>
                <th className="px-4 py-3 text-left font-medium">Periode</th>
                <th className="px-4 py-3 text-left font-medium">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {projects.map((p) => (
                <tr key={p.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">
                    <button
                      onClick={() => window.location.href = `/teacher/projects/${p.id}`}
                      className="text-left hover:underline"
                    >
                      {p.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{p.role}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {p.start_date ? new Date(p.start_date).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' }) : ''}
                    {p.start_date && p.end_date ? ' – ' : ''}
                    {p.end_date ? new Date(p.end_date).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' }) : ''}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => window.location.href = `/teacher/projects/${p.id}`}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Project openen
                      </button>
                      <button
                        onClick={() => handleUnlinkProject(p.id)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                      >
                        Ontkoppel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Link Project Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
            <h2 className="text-lg font-semibold mb-4">Project koppelen</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Selecteer een project
              </label>
              <select
                value={selectedProjectId || ""}
                onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Kies een project...</option>
                {allProjects
                  .filter(proj => !projects.some(p => p.id === proj.id))
                  .map(proj => (
                    <option key={proj.id} value={proj.id}>
                      {proj.title}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setSelectedProjectId(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={linkingProject}
              >
                Annuleren
              </button>
              <button
                onClick={handleLinkProject}
                disabled={!selectedProjectId || linkingProject}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {linkingProject ? "Bezig..." : "Koppelen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// TAB: Documenten
function DocumentenTab() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Documenten</h3>
          <p className="text-xs text-slate-500">
            Upload hier samenwerkingsovereenkomsten, projectbeschrijvingen en andere documenten.
          </p>
        </div>
        <button className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700">
          + Document uploaden
        </button>
      </div>
      <div className="rounded-xl bg-slate-50 px-3 py-8 text-center shadow-sm ring-1 ring-slate-100">
        <p className="text-sm text-slate-500">Geen documenten beschikbaar (mockdata)</p>
      </div>
    </div>
  );
}

// TAB: Communicatie
function CommunicatieTab({ client }: { client: any }) {
  const [selectedTemplate, setSelectedTemplate] = useState("startproject");
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [emailPreview, setEmailPreview] = useState("");

  const templates = {
    startproject: "Startproject",
    tussenpresentatie: "Tussenpresentatie",
    eindpresentatie: "Eindpresentatie",
    bedankmail: "Bedankmail",
  };

  const mockModules = [
    { id: "5v1", label: "5V1 - Bovenbouw VWO" },
    { id: "4h2", label: "4H2 - Bovenbouw HAVO" },
    { id: "3h1", label: "3H1 - Onderbouw HAVO" },
  ];

  const mockTeams = [
    { id: "t1", label: "Team 1" },
    { id: "t2", label: "Team 2" },
    { id: "t3", label: "Team 3" },
    { id: "t4", label: "Team 4" },
  ];

  const generateEmail = () => {
    const template = templates[selectedTemplate as keyof typeof templates];
    const moduleName = mockModules.find(m => m.id === selectedModule)?.label || "N/A";
    const teams = selectedTeams.map(t => mockTeams.find(mt => mt.id === t)?.label || t).join(", ");
    
    const preview = `Beste ${client.contact_name || 'opdrachtgever'},

Hierbij nodigen wij u uit voor de ${template.toLowerCase()} van het project.

Module: ${moduleName}
Teams: ${teams}

Met vriendelijke groet,
Het docententeam`;

    setEmailPreview(preview);
  };

  const handleOpenInOutlook = () => {
    const subject = `${templates[selectedTemplate as keyof typeof templates]} - ${client.organization}`;
    const mailtoLink = buildMailto({
      to: client.email || "",
      subject,
      body: emailPreview,
    });
    
    window.open(mailtoLink, '_self');
    console.log("Log entry added: Mail verzonden via Outlook");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Communicatie</h3>
          <p className="text-xs text-slate-500">
            Stel een mail op met een template en open deze in Outlook.
          </p>
        </div>
        <button
          onClick={() => window.open(buildMailto({ to: client.email || "", subject: "", body: "" }), '_self')}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Mail openen in Outlook
        </button>
      </div>

      {/* Template selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">Template</label>
        <select 
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
        >
          {Object.entries(templates).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Module / Class selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">Module / Klas</label>
        <select 
          value={selectedModule}
          onChange={(e) => setSelectedModule(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
        >
          <option value="">Selecteer module...</option>
          {mockModules.map((module) => (
            <option key={module.id} value={module.id}>{module.label}</option>
          ))}
        </select>
      </div>

      {/* Teams selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">Teams</label>
        <div className="flex flex-wrap gap-2">
          {mockTeams.map((team) => (
            <button
              key={team.id}
              onClick={() => {
                if (selectedTeams.includes(team.id)) {
                  setSelectedTeams(selectedTeams.filter(t => t !== team.id));
                } else {
                  setSelectedTeams([...selectedTeams, team.id]);
                }
              }}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                selectedTeams.includes(team.id)
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {team.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button 
        onClick={generateEmail}
        className="w-full rounded-lg border border-indigo-500 bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
      >
        Genereer mail preview
      </button>

      {/* Email preview */}
      {emailPreview && (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Mail preview</label>
            <textarea
              value={emailPreview}
              onChange={(e) => setEmailPreview(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
            />
          </div>

          {/* Open in Outlook button */}
          <button 
            onClick={handleOpenInOutlook}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            📧 Open in Outlook
          </button>
        </>
      )}
    </div>
  );
}
