"use client";

import { useState } from "react";
import Link from "next/link";

// Helper function for building mailto links
function buildMailto({ to, subject, body }: { to: string; subject: string; body: string }) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// TODO: vervang mock data door echte data uit je API / loader
const mockClient = {
  id: "1",
  organization: "Greystar",
  contactName: "Sanne de Vries",
  email: "sanne.devries@greystar.nl",
  level: "Bovenbouw",
  sector: "Vastgoed",
  tags: ["Duurzaamheid", "Mixed-use", "Stadsontwikkeling"],
  active: true,
};

const mockProjects = [
  {
    id: "p1",
    name: "Gemeenschappelijke ruimte mixed-use gebouw",
    year: "2024–2025",
    level: "5 VWO",
    className: "5V1",
    teams: 4,
    role: "Hoofdopdrachtgever",
  },
  {
    id: "p2",
    name: "Bewonersbeleving & gedeelde functies",
    year: "2023–2024",
    level: "4 HAVO",
    className: "4H2",
    teams: 3,
    role: "Hoofdopdrachtgever",
  },
];

const mockLog = [
  {
    date: "2025-03-01",
    type: "Notitie",
    text: "Greystar wil volgend jaar graag weer een project, liefst in periode 3.",
    author: "Nick Veerman",
  },
  {
    date: "2025-02-10",
    type: "Mail (template)",
    text: "Bedankmail eindpresentatie verzonden.",
    author: "Systeem",
  },
  {
    date: "2025-01-20",
    type: "Notitie",
    text: "Tussenpresentatie goed verlopen, stellen peerfeedback erg op prijs.",
    author: "Nick Veerman",
  },
];

export default function ClientDetailPage() {
  const [activeTab, setActiveTab] = useState<"logboek" | "projecten" | "documenten" | "communicatie">("logboek");
  const c = mockClient;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-500 flex items-center gap-1">
        <Link href="/teacher/clients" className="hover:underline">
          Opdrachtgevers
        </Link>
        <span className="text-slate-400">/</span>
        <span className="truncate max-w-xs sm:max-w-sm md:max-w-md">
          {c.organization}
        </span>
      </div>

      {/* Header + acties */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 flex flex-wrap items-center gap-2">
            {c.organization}
            {c.active ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-100">
                Actief
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                Inactief
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {c.sector} · {c.level}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 border border-sky-100"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-start md:justify-end">
          <button className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50">
            Bewerken
          </button>
          <button className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50">
            Verplaats naar archief
          </button>
          <button className="inline-flex items-center rounded-xl border border-sky-500 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-sky-700">
            + Nieuwe notitie
          </button>
        </div>
      </div>

      {/* Bovenste rij kaarten */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr),minmax(0,3fr)]">
        {/* Contactkaart */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Contactgegevens
          </h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Contactpersoon</dt>
              <dd className="text-slate-800">{c.contactName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">E-mail</dt>
              <dd className="text-slate-800 break-all">{c.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Niveau</dt>
              <dd className="text-slate-800">{c.level}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Sector</dt>
              <dd className="text-slate-800">{c.sector}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <button 
              onClick={() => window.open(buildMailto({ to: c.email, subject: "", body: "" }), '_self')}
              className="flex-1 min-w-[120px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
            >
              Mail openen
            </button>
            <button 
              onClick={() => navigator.clipboard.writeText(c.email)}
              className="flex-1 min-w-[120px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
            >
              Kopieer contact
            </button>
          </div>
        </section>

        {/* Relatie / kleine KPI's */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Overzicht samenwerking
          </h2>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Projecten totaal</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">5</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Laatste jaar actief</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                2024–2025
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Relatiestatus</p>
              <p className="mt-1 text-xs font-medium text-emerald-600">
                Stevige samenwerking
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Onderste deel: tabs + inhoud */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-4 pt-3">
          {[
            { key: "logboek" as const, label: "Logboek" },
            { key: "projecten" as const, label: "Projecten" },
            { key: "documenten" as const, label: "Documenten" },
            { key: "communicatie" as const, label: "Communicatie" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`mr-4 border-b-2 pb-2 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-sky-500 text-sky-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-4 py-4">
          {activeTab === "logboek" && <LogboekTab />}
          {activeTab === "projecten" && <ProjectenTab />}
          {activeTab === "documenten" && <DocumentenTab />}
          {activeTab === "communicatie" && <CommunicatieTab />}
        </div>
      </section>
    </div>
  );
}

function LogboekTab() {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Contactmomenten & notities
        </h3>
        <button className="text-xs text-sky-600 hover:text-sky-700">
          + Notitie toevoegen
        </button>
      </div>
      <div className="space-y-3">
        {mockLog.map((item, i) => (
          <article
            key={i}
            className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-500 mb-1.5">
              <span>{item.date}</span>
              <span>
                {item.type} · {item.author}
              </span>
            </div>
            <p className="text-sm text-slate-800">{item.text}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function ProjectenTab() {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Gekoppelde projecten
        </h3>
        <button className="text-xs text-sky-600 hover:text-sky-700">
          Project koppelen
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {mockProjects.map((p) => (
          <article
            key={p.id}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-900">
              {p.name}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {p.year} · {p.level} · {p.className}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Teams: {p.teams} · Rol: {p.role}
            </p>
            <div className="mt-2 flex justify-between items-center text-xs">
              <button className="text-sky-600 hover:text-sky-700">
                Ga naar project
              </button>
              <button className="text-slate-500 hover:text-slate-700">
                Ontkoppel
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function DocumentenTab() {
  return (
    <div className="text-center py-8 text-slate-500">
      <p>Geen documenten beschikbaar (mockdata)</p>
    </div>
  );
}

function CommunicatieTab() {
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
    const module = mockModules.find(m => m.id === selectedModule)?.label || "N/A";
    const teams = selectedTeams.map(t => mockTeams.find(mt => mt.id === t)?.label || t).join(", ");
    
    const preview = `Beste ${mockClient.contactName},

Hierbij nodigen wij u uit voor de ${template.toLowerCase()} van het project.

Module: ${module}
Teams: ${teams}

Met vriendelijke groet,
Het docententeam`;

    setEmailPreview(preview);
  };

  const handleOpenInOutlook = () => {
    const subject = `${templates[selectedTemplate as keyof typeof templates]} - ${mockClient.organization}`;
    const mailtoLink = buildMailto({
      to: mockClient.email,
      subject,
      body: emailPreview,
    });
    
    window.open(mailtoLink, '_self');
    
    // Mock: add entry to log
    console.log("Log entry added: Mail verzonden via Outlook");
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Communicatie template
      </h3>
      
      {/* Template selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">Template</label>
        <select 
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
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
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
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
                  ? 'border-sky-500 bg-sky-50 text-sky-700'
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
        className="w-full rounded-lg border border-sky-500 bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700"
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
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/60"
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
