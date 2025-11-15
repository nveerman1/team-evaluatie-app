"use client";

import { useState } from "react";
import Link from "next/link";

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

const mockClients = [
  {
    id: "1",
    organization: "Greystar",
    contactName: "Sanne de Vries",
    email: "sanne.devries@greystar.nl",
    level: "Bovenbouw",
    sector: "Vastgoed",
    projectsThisYear: 3,
    lastActive: "2025-03-10",
    status: "Actief",
    tags: ["Duurzaamheid", "Mixed-use"],
    hadProjectLastYear: true,
  },
  {
    id: "2",
    organization: "Koninklijke Marine",
    contactName: "Richard Gans",
    email: "r.gans@mindef.nl",
    level: "Bovenbouw",
    sector: "Defensie",
    projectsThisYear: 1,
    lastActive: "2025-01-22",
    status: "Actief",
    tags: ["Defensie"],
    hadProjectLastYear: true,
  },
  {
    id: "3",
    organization: "Rijndam Revalidatie",
    contactName: "Lotte Janssen",
    email: "l.janssen@rijndam.nl",
    level: "Onderbouw",
    sector: "Zorg",
    projectsThisYear: 0,
    lastActive: "2023-11-05",
    status: "Inactief",
    tags: ["Healthcare"],
    hadProjectLastYear: false,
  },
  {
    id: "4",
    organization: "NS",
    contactName: "Pieter Jansen",
    email: "contact@ns.nl",
    level: "Bovenbouw",
    sector: "Mobiliteit",
    projectsThisYear: 2,
    lastActive: "2025-02-15",
    status: "Actief",
    tags: ["Mobiliteit", "Duurzaamheid"],
    hadProjectLastYear: true,
  },
  {
    id: "5",
    organization: "Eneco",
    contactName: "Maria van den Berg",
    email: "info@eneco.nl",
    level: "Onderbouw",
    sector: "Energie",
    projectsThisYear: 1,
    lastActive: "2024-12-10",
    status: "Actief",
    tags: ["Duurzaamheid", "Circulaire economie"],
    hadProjectLastYear: true,
  },
];

export default function ClientsPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "list" | "communication">("dashboard");

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
        <button className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50">
          + Nieuwe opdrachtgever
        </button>
      </div>

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
      {activeTab === "list" && <ListTab />}
      {activeTab === "communication" && <CommunicationTab />}
    </div>
  );
}

// Tab 1: Dashboard - Inzicht & relatie-health
function DashboardTab() {
  return (
    <>
      {/* KPI Cards in one row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Actieve opdrachtgevers</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">18</p>
          <p className="mt-1 text-[11px] text-emerald-600">+4 t.o.v. vorig jaar</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Projecten dit jaar</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">32</p>
          <p className="mt-1 text-[11px] text-slate-500">Gem. 1,8 per opdrachtgever</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Risico op afhaak</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">5</p>
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
            {[
              { name: "Deloitte", sector: "Consultancy", date: "2024-09-15" },
              { name: "Eneco", sector: "Energie", date: "2024-10-03" },
            ].map((client, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-emerald-100">
                <div>
                  <span className="text-sm text-slate-800 font-medium">{client.name}</span>
                  <span className="text-xs text-slate-500 ml-2">· {client.sector}</span>
                </div>
                <span className="text-xs text-slate-500">{client.date}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Top-samenwerkingen */}
        <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-sky-900 mb-3">
            🏆 Top-samenwerkingen
          </h3>
          <p className="text-xs text-slate-600 mb-3">Organisaties met meeste projecten / jaren samenwerking</p>
          <div className="space-y-2">
            {[
              { name: "Greystar", projects: 12, years: "5 jaar" },
              { name: "Koninklijke Marine", projects: 8, years: "3 jaar" },
              { name: "NS", projects: 6, years: "4 jaar" },
            ].map((client, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-sky-100">
                <div>
                  <span className="text-sm text-slate-800 font-medium">{client.name}</span>
                  <span className="text-xs text-slate-500 ml-2">· {client.years}</span>
                </div>
                <span className="text-xs font-medium text-sky-700">{client.projects} projecten</span>
              </div>
            ))}
          </div>
        </section>

        {/* Risico op afhaak */}
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-amber-900 mb-3">
            ⚠️ Risico op afhaak
          </h3>
          <p className="text-xs text-slate-600 mb-3">Organisaties waarbij lastActive &gt; 1 jaar geleden</p>
          <div className="space-y-2">
            {[
              { name: "Rijndam Revalidatie", lastActive: "2023-11-05" },
              { name: "Havenbedrijf Rotterdam", lastActive: "2023-09-12" },
              { name: "Gemeente Den Haag", lastActive: "2023-08-20" },
            ].map((client, idx) => (
              <div key={idx} className="flex flex-col p-2 bg-white rounded-lg border border-amber-100">
                <span className="text-sm text-slate-800 font-medium">{client.name}</span>
                <span className="text-xs text-slate-500">Laatst: {client.lastActive}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

// Tab 2: List & filters
function ListTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("Alle");
  const [selectedYear, setSelectedYear] = useState("2025–2026");
  const [showRiskOnly, setShowRiskOnly] = useState(false);

  // Filter clients based on search and filters
  const filteredClients = mockClients.filter(client => {
    // Search filter
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      const matchesSearch = 
        client.organization.toLowerCase().includes(search) ||
        client.contactName.toLowerCase().includes(search) ||
        client.sector.toLowerCase().includes(search) ||
        client.tags.some(tag => tag.toLowerCase().includes(search));
      if (!matchesSearch) return false;
    }

    // Level filter
    if (selectedLevel !== "Alle" && client.level !== selectedLevel) {
      return false;
    }

    // Risk filter
    if (showRiskOnly) {
      const lastActiveDate = new Date(client.lastActive);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      if (lastActiveDate > oneYearAgo) return false;
    }

    return true;
  });

  return (
    <>
      {/* Expertise tags */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Expertise-tags</h3>
        <div className="flex flex-wrap gap-2">
          {[
            "Duurzaamheid",
            "AI/Tech",
            "Healthcare",
            "Mobiliteit",
            "Circulaire economie",
            "Defensie",
            "Mixed-use",
            "Stadsontwikkeling",
          ].map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-xs font-medium text-purple-700"
            >
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-600 block mb-1.5">Zoeken</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek op naam, organisatie, sector, tags…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
          />
        </div>
        <div className="w-40">
          <label className="text-xs font-medium text-slate-600 block mb-1.5">Niveau</label>
          <select 
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
          >
            <option>Alle</option>
            <option>Onderbouw</option>
            <option>Bovenbouw</option>
          </select>
        </div>
        <div className="w-40">
          <label className="text-xs font-medium text-slate-600 block mb-1.5">Schooljaar</label>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
          >
            <option>2025–2026</option>
            <option>2024–2025</option>
            <option>2023–2024</option>
          </select>
        </div>
        <div>
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={showRiskOnly}
              onChange={(e) => setShowRiskOnly(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-sm font-medium text-slate-700">Risico op afhaak</span>
          </label>
        </div>
      </div>

      {/* Table */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {filteredClients.length} opdrachtgever{filteredClients.length !== 1 ? 's' : ''} gevonden
          </p>
          <button className="text-xs text-slate-500 hover:text-slate-700">
            Exporteer als CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-500">
                <th className="px-4 py-2.5">Organisatie</th>
                <th className="px-4 py-2.5">Contactpersoon + email</th>
                <th className="px-4 py-2.5">Niveau</th>
                <th className="px-4 py-2.5">Sector</th>
                <th className="px-4 py-2.5">Projecten dit jaar</th>
                <th className="px-4 py-2.5">Laatst actief</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client, index) => (
                <tr
                  key={client.id}
                  className={`border-t border-slate-100 ${
                    index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {client.organization}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    <div className="flex flex-col">
                      <span>{client.contactName}</span>
                      <span className="text-xs text-slate-500">
                        {client.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{client.level}</td>
                  <td className="px-4 py-2.5 text-slate-700">{client.sector}</td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {client.projectsThisYear}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {client.lastActive}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        client.status === 'Actief'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-slate-50 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {client.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link 
                      href={`/teacher/clients/${client.id}`}
                      className="text-xs font-medium text-sky-600 hover:text-sky-700"
                    >
                      Details &gt;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// Tab 3: Communication
function CommunicationTab() {
  const [schoolYear, setSchoolYear] = useState("2025–2026");
  const [level, setLevel] = useState("Alle");
  const [template, setTemplate] = useState("opvolgmail");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  // Filter clients based on criteria
  const filteredClients = mockClients.filter(client => {
    if (!client.hadProjectLastYear) return false;
    if (level !== "Alle" && client.level !== level) return false;
    return true;
  });

  const toggleClient = (clientId: string) => {
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

  // Mock recent communications
  const recentCommunications = [
    {
      id: "1",
      title: "Bedankmail eindpresentatie",
      organization: "Greystar",
      date: "2025-03-10",
      clientId: "1",
    },
    {
      id: "2",
      title: "Uitnodiging tussenpresentatie",
      organization: "Koninklijke Marine",
      date: "2025-02-15",
      clientId: "2",
    },
    {
      id: "3",
      title: "Startproject-mail",
      organization: "NS",
      date: "2025-01-20",
      clientId: "4",
    },
  ];

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
            {filteredClients.length === 0 ? (
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
                    <div className="text-xs text-slate-500">{client.email}</div>
                  </div>
                  <div className="text-xs text-slate-500">{client.level}</div>
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
                href={`/teacher/clients/${comm.clientId}`}
                className="text-xs font-medium text-sky-600 hover:text-sky-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white"
              >
                Opdrachtgever openen
              </Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
