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
  const [activeTab, setActiveTab] = useState<"dashboard" | "list" | "communication">("dashboard");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleClientCreated = () => {
    // Trigger a refresh by updating the key
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
            Opdrachtgevers
          </h1>
          <p className="text-slate-600 mt-1 text-sm md:text-base">
            Beheer contactgegevens, projecten en samenwerkingen met externe partners.
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
        >
          + Nieuwe opdrachtgever
        </button>
      </div>

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
      {activeTab === "dashboard" && <DashboardTab />}
      {activeTab === "list" && <ListTab refreshKey={refreshKey} />}
      {activeTab === "communication" && <CommunicationTab />}
    </div>
  );
}

// Tab 1: Dashboard - Inzicht & relatie-health
function DashboardTab() {
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
              onClick={() => {/* Navigate to list view */}}
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
              onClick={() => {/* Navigate to list view */}}
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
              onClick={() => {/* Navigate to list view */}}
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

// Tab 2: List & filters
function ListTab({ refreshKey }: { refreshKey?: number }) {
  return <ClientsList refreshKey={refreshKey} />;
}


// Tab 3: Communication
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
