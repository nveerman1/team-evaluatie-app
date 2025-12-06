"use client";

import { useState } from "react";
import Link from "next/link";

// Helper function for building mailto links
function buildMailto({ bcc, subject, body }: { bcc?: string; subject: string; body: string }) {
  if (bcc) {
    return `mailto:?bcc=${bcc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const mockClients = [
  {
    id: "1",
    organization: "Greystar",
    email: "sanne.devries@greystar.nl",
    hadProjectLastYear: true,
    level: "Bovenbouw",
  },
  {
    id: "2",
    organization: "Koninklijke Marine",
    email: "r.gans@mindef.nl",
    hadProjectLastYear: true,
    level: "Bovenbouw",
  },
  {
    id: "3",
    organization: "Rijndam Revalidatie",
    email: "l.janssen@rijndam.nl",
    hadProjectLastYear: false,
    level: "Onderbouw",
  },
  {
    id: "4",
    organization: "NS",
    email: "contact@ns.nl",
    hadProjectLastYear: true,
    level: "Bovenbouw",
  },
  {
    id: "5",
    organization: "Eneco",
    email: "info@eneco.nl",
    hadProjectLastYear: true,
    level: "Onderbouw",
  },
];

export default function BulkCommunicationPage() {
  const [schoolYear, setSchoolYear] = useState("2025-2026");
  const [level, setLevel] = useState("Alle");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [template, setTemplate] = useState("opvolgmail");

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
        body: `Beste opdrachtgever,

Het schooljaar ${schoolYear} staat voor de deur en wij willen graag onze samenwerking voortzetten.

Heeft u interesse om opnieuw een project met onze leerlingen te doen?

Met vriendelijke groet,
Het docententeam`,
      },
      startproject: {
        subject: "Uitnodiging startproject",
        body: `Beste opdrachtgever,

Graag nodigen wij u uit voor de start van ons nieuwe project.

We kijken uit naar de samenwerking!

Met vriendelijke groet,
Het docententeam`,
      },
    };

    const selectedTemplate = templates[template] || templates.opvolgmail;
    const mailtoLink = buildMailto({
      bcc: selectedEmails,
      subject: selectedTemplate.subject,
      body: selectedTemplate.body,
    });

    window.open(mailtoLink, '_self');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-500 flex items-center gap-1">
        <Link href="/teacher/clients" className="hover:underline">
          Opdrachtgevers
        </Link>
        <span className="text-slate-400">/</span>
        <span>Communicatie</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
          Bulk Communicatie
        </h1>
        <p className="text-slate-600 mt-1 text-sm md:text-base">
          Verstuur mails naar meerdere opdrachtgevers tegelijk.
        </p>
      </div>

      {/* Section A: Jaarlijkse opvolging */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-lg font-semibold text-slate-900">
            📬 Jaarlijkse opvolging (bulk mail)
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Verstuur een opvolgmail naar opdrachtgevers die vorig schooljaar een module hadden.
          </p>
        </div>

        {/* Filters */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Schooljaar</label>
            <select 
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
            >
              <option>2025–2026</option>
              <option>2024–2025</option>
              <option>2023–2024</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Niveau</label>
            <select 
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
            >
              <option>Alle</option>
              <option>Onderbouw</option>
              <option>Bovenbouw</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Template</label>
            <select 
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/60"
            >
              <option value="opvolgmail">Opvolgmail volgend schooljaar</option>
              <option value="startproject">Bulk startmail</option>
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

        {/* Action button */}
        <div className="flex items-center gap-3 pt-2">
          <button 
            onClick={handleSendBulkEmail}
            disabled={selectedClients.length === 0}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm ${
              selectedClients.length > 0
                ? 'bg-sky-600 text-white hover:bg-sky-700 border border-sky-500'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            📧 Open mail in Outlook voor geselecteerde opdrachtgevers ({selectedClients.length})
          </button>
        </div>

        {selectedClients.length > 0 && (
          <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-xs text-sky-800">
            <strong>Let op:</strong> De geselecteerde opdrachtgevers worden toegevoegd aan het BCC-veld, 
            zodat ze elkaars e-mailadres niet zien.
          </div>
        )}
      </section>

      {/* Section B: Bulk startmail (optional) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-lg font-semibold text-slate-900">
            🚀 Bulk startmail
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Verstuur een startmail naar alle opdrachtgevers voor een nieuw project.
          </p>
        </div>

        <div className="text-center py-8 text-slate-500">
          <p className="text-sm">Gebruik dezelfde filters hierboven en selecteer &quot;Bulk startmail&quot; als template.</p>
        </div>
      </section>
    </div>
  );
}
