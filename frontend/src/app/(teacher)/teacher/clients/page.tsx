"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ClientFormModal } from "@/components/clients/ClientFormModal";
import { ClientsList } from "@/components/clients/ClientsList";
import { clientService } from "@/services/client.service";
import { listMailTemplates } from "@/services/mail-template.service";
import type { MailTemplateDto } from "@/dtos/mail-template.dto";

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
  const [activeTab, setActiveTab] = useState<"list" | "communication">("list");
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
              Beheer organisaties en contactpersonen. Klik op een opdrachtgever voor details.
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
          onClick={() => setActiveTab("list")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "list"
              ? "border-sky-500 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Alle opdrachtgevers
        </button>
        <button
          onClick={() => setActiveTab("communication")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "communication"
              ? "border-sky-500 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Communicatie &amp; bulkmail
        </button>
      </div>

        {/* Tab Content */}
        {activeTab === "list" && <ListTab refreshKey={refreshKey} />}
        {activeTab === "communication" && <CommunicationTab />}
      </div>
    </>
  );
}

// Tab 1: List & filters
function ListTab({ refreshKey }: { refreshKey?: number }) {
  return <ClientsList refreshKey={refreshKey} />;
}


// Tab 2: Communication
function CommunicationTab() {
  const [schoolYear, setSchoolYear] = useState("2025-2026");
  const [level, setLevel] = useState("Alle");
  const [template, setTemplate] = useState("");
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  
  // Mail templates from API
  const [mailTemplates, setMailTemplates] = useState<MailTemplateDto[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  
  // Fetch mail templates
  useEffect(() => {
    async function fetchMailTemplates() {
      try {
        setTemplatesLoading(true);
        const templates = await listMailTemplates({ is_active: true });
        setMailTemplates(templates);
        // Set default template to first one if available (only on initial load)
        if (templates.length > 0) {
          setTemplate((prev) => prev === "" ? templates[0].type : prev);
        } else {
          setTemplate((prev) => prev === "" ? "opvolgmail" : prev);
        }
      } catch (err) {
        console.error("Error fetching mail templates:", err);
        // Fall back to default template type (only on initial load)
        setTemplate((prev) => prev === "" ? "opvolgmail" : prev);
      } finally {
        setTemplatesLoading(false);
      }
    }
    fetchMailTemplates();
  }, []);

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

    // First try to find the template from API, then fall back to default
    const apiTemplate = mailTemplates.find(t => t.type === template);
    let emailSubject: string;
    let emailBody: string;
    
    if (apiTemplate) {
      // Use template from API, replace {schoolYear} variable if present
      emailSubject = apiTemplate.subject.replace(/\{schoolYear\}/g, schoolYear);
      emailBody = apiTemplate.body.replace(/\{schoolYear\}/g, schoolYear);
    } else {
      // Fall back to default templates
      const defaultTemplate = DEFAULT_TEMPLATES[template] || DEFAULT_TEMPLATES.opvolgmail;
      emailSubject = defaultTemplate.subject.replace(/volgend schooljaar/g, `schooljaar ${schoolYear}`);
      emailBody = defaultTemplate.body;
    }

    const mailtoLink = buildMailto({
      to: selectedEmails,
      subject: emailSubject,
      body: emailBody,
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
    <div className="flex flex-col gap-4">
      {/* Bulk communicatie - Two column layout */}
      <div className="grid gap-4 lg:grid-cols-[3fr,2fr]">
        {/* Left column: Mail naar opdrachtgevers */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Mail naar opdrachtgevers</h2>
          <p className="mt-1 text-xs text-slate-500">
            Kies een schooljaar, niveau en mailtemplate om meerdere opdrachtgevers tegelijk te mailen.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-slate-600">Schooljaar</span>
              <select
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:outline-none"
              >
                <option>2025-2026</option>
                <option>2024-2025</option>
                <option>2023-2024</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-slate-600">Niveau</span>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:outline-none"
              >
                <option>Alle</option>
                <option>Onderbouw</option>
                <option>Bovenbouw</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-slate-600">Template</span>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:outline-none"
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
                    <option value="opvolgmail">Opvolgmail volgend schooljaar</option>
                    <option value="startproject">Startproject-mail</option>
                    <option value="tussenpresentatie">Uitnodiging tussenpresentatie</option>
                    <option value="eindpresentatie">Uitnodiging eindpresentatie</option>
                    <option value="bedankmail">Bedankmail</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between gap-2 text-xs">
              <p className="font-medium text-slate-800">Geselecteerde opdrachtgevers</p>
              <button
                onClick={toggleAll}
                className="text-xs font-medium text-indigo-600 hover:underline"
              >
                {selectedClients.length === filteredClients.length ? "Deselecteer alles" : "Selecteer alles"}
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2 text-sm max-h-64 overflow-y-auto">
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
                  <label key={client.id} className="flex items-start gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedClients.includes(client.id)}
                      onChange={() => toggleClient(client.id)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      <span className="font-medium">{client.organization}</span>
                      <span className="text-slate-400"> · {client.email}</span>
                      <span className="block text-[11px] text-slate-500">
                        {client.level} · {client.projects_this_year || 0} projecten totaal
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <button
            onClick={handleSendBulkEmail}
            disabled={selectedClients.length === 0}
            className={`mt-4 inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-medium shadow-sm transition ${
              selectedClients.length > 0
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            Mail versturen via Outlook ({selectedClients.length})
          </button>
        </div>

        {/* Right column: Laatste communicatie log */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Laatste communicatie</h3>
            <button className="text-xs font-medium text-indigo-600 hover:underline">Nieuwe notitie</button>
          </div>
          {communicationsLoading ? (
            <div className="text-center py-8 text-slate-500 text-sm">Laden...</div>
          ) : recentCommunications.length > 0 ? (
            <ul className="space-y-3 text-sm">
              {recentCommunications.map((comm) => (
                <li
                  key={comm.id}
                  className="rounded-xl bg-white/80 p-3 shadow-sm ring-1 ring-slate-100"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-700">Email</p>
                    <p className="text-[11px] text-slate-400">{comm.date}</p>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{comm.title}</p>
                  <p className="text-xs text-slate-500">{comm.organization}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">Nog geen communicatie gelogd</div>
          )}
        </div>
      </div>
    </div>
  );
}
