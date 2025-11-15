"use client";

import { useState } from "react";
import Link from "next/link";

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
  },
];

export default function ClientsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "communication">("overview");

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
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-sky-500 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Overzicht
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
      {activeTab === "overview" && <ClientsOverviewTab />}
      {activeTab === "communication" && <CommunicationTab />}
    </div>
  );
}

function ClientsOverviewTab() {
  return (
    <>
      {/* Filters + stats */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr),minmax(0,3fr)]">
        {/* Filters */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800">Filters</h2>
            <button className="text-xs text-slate-500 hover:text-slate-700">
              Reset
            </button>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Schooljaar</label>
              <select className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60">
                <option>2025–2026</option>
                <option>2024–2025</option>
                <option>2023–2024</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Niveau</label>
              <div className="flex gap-2">
                {['Alle', 'Onderbouw', 'Bovenbouw'].map((label) => (
                  <button
                    key={label}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      label === 'Alle'
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Risico op afhaak</label>
              <div className="flex gap-2">
                {['Alle', 'Ja'].map((label) => (
                  <button
                    key={label}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      label === 'Alle'
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Zoeken</label>
              <input
                type="text"
                placeholder="Zoek op naam of organisatie…"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
              />
            </div>
          </div>
        </section>

        {/* Kleine stats / KPI-kaarten */}
        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs text-slate-500">Actieve opdrachtgevers</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">18</p>
            <p className="mt-1 text-[11px] text-emerald-600">+4 t.o.v. vorig jaar</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs text-slate-500">Projecten dit jaar</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">32</p>
            <p className="mt-1 text-[11px] text-slate-500">Gem. 1,8 per opdrachtgever</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs text-slate-500">Risico op afhaak</p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">5</p>
            <p className="mt-1 text-[11px] text-amber-600">&gt; 1 jaar geen project</p>
          </div>
        </section>
      </div>

      {/* Tabel */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {mockClients.length} opdrachtgevers gevonden
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
                <th className="px-4 py-2.5">Contactpersoon</th>
                <th className="px-4 py-2.5">Niveau</th>
                <th className="px-4 py-2.5">Sector</th>
                <th className="px-4 py-2.5">Projecten dit jaar</th>
                <th className="px-4 py-2.5">Laatst actief</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {mockClients.map((client, index) => (
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

      {/* Segment blocks */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Risico-op-afhaak segment */}
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-amber-900 mb-3">
            ⚠️ Risico op afhaak (&gt;1 jaar geen project)
          </h3>
          <div className="space-y-2">
            {[
              { name: "Rijndam Revalidatie", lastActive: "2023-11-05" },
              { name: "Havenbedrijf Rotterdam", lastActive: "2023-09-12" },
              { name: "Gemeente Den Haag", lastActive: "2023-08-20" },
            ].map((client, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-100">
                <span className="text-sm text-slate-800">{client.name}</span>
                <span className="text-xs text-slate-500">Laatst: {client.lastActive}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Nieuwe opdrachtgevers segment */}
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-emerald-900 mb-3">
            ✨ Nieuwe opdrachtgevers (dit schooljaar)
          </h3>
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

        {/* Top-samenwerkingen segment */}
        <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-sky-900 mb-3">
            🏆 Top-samenwerkingen (meeste projecten)
          </h3>
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

        {/* Extra expertise segment */}
        <section className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-purple-900 mb-3">
            💡 Extra expertise (tags)
          </h3>
          <div className="flex flex-wrap gap-2">
            {[
              "Duurzaamheid",
              "AI/Tech",
              "Stadsontwikkeling",
              "Healthcare",
              "Mobiliteit",
              "Circulaire economie",
              "Defensie",
              "Mixed-use",
            ].map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded-full bg-white border border-purple-200 px-3 py-1 text-xs font-medium text-purple-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function CommunicationTab() {
  return (
    <div className="space-y-6">
      <p className="text-slate-600 text-sm">
        De bulk communicatiepagina wordt weergegeven op{" "}
        <Link href="/teacher/clients/communication" className="text-sky-600 hover:underline">
          /teacher/clients/communication
        </Link>
      </p>
    </div>
  );
}
