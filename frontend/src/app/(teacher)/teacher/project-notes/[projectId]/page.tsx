"use client";

import { useState } from "react";
import { use } from "react";
import { SidebarTab } from "./_components/SidebarTab";
import { ProjectNotesCard } from "./_components/ProjectNotesCard";
import { TeamNotesCard } from "./_components/TeamNotesCard";
import { StudentNotesCard } from "./_components/StudentNotesCard";
import { TimelineCard } from "./_components/TimelineCard";

type TabKey = "project" | "teams" | "students" | "timeline";

interface Team {
  id: number;
  name: string;
  focus: string;
  members: string[];
}

const TEAMS: Team[] = [
  {
    id: 1,
    name: "Team 1 – Woonhub Noord",
    focus: "Samenwerking · Organiseren",
    members: ["Sara", "Milan", "Noor", "Jayden"],
  },
  {
    id: 2,
    name: "Team 2 – Groene daken",
    focus: "Creativiteit · Denkwijzen",
    members: ["Lotte", "Yara", "Thijs"],
  },
  {
    id: 3,
    name: "Team 3 – Mobiliteit",
    focus: "Planning · Doorzetten",
    members: ["Ruben", "Emma", "Sven"],
  },
];

export default function ProjectNotesDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  
  const [activeTab, setActiveTab] = useState<TabKey>("teams");
  const [selectedTeamId, setSelectedTeamId] = useState<number>(1);
  const [selectedStudentName, setSelectedStudentName] = useState<string | null>("Sara");
  const [quickNoteText, setQuickNoteText] = useState<string>("");

  const selectedTeam = TEAMS.find((t) => t.id === selectedTeamId) ?? TEAMS[0];

  function handleSelectTeam(id: number) {
    setSelectedTeamId(id);
    setActiveTab("teams");
  }

  function handleSelectStudent(name: string) {
    setSelectedStudentName(name);
    setActiveTab("students");
  }

  function handleQuickNoteClick(template: string) {
    setQuickNoteText(template);
  }

  // TODO: Fetch project data from API using projectId
  const projectTitle = "Duurzame wijk"; // This would come from API

  return (
    <>
      {/* PAGE HEADER */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Aantekeningen – Project &quot;{projectTitle}&quot;
            </h1>
            <p className="text-gray-600 mt-1 text-sm max-w-xl">
              Centrale plek voor observaties, snelnotities en koppeling aan OMZA, rubrics en competenties.
            </p>
          </div>
          <div className="flex items-center gap-2 md:self-center">
            <button className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Exporteren (dummy)
            </button>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
              Nieuwe notitie
            </button>
          </div>
        </header>
      </div>

      {/* PAGE CONTENT */}
      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          {/* BOVENSTE RIJ: filters + quick note context */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 md:mb-6">
            {/* Filters & search (dummy) */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Zoek in aantekeningen..."
                  className="w-64 max-w-full rounded-xl border border-gray-200/80 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-500 shadow-sm"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400 text-[11px]">
                  ⌘K
                </span>
              </div>

              {/* Zoek op naam */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Zoek op naam..."
                  className="w-52 max-w-full rounded-xl border border-gray-200/80 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500 shadow-sm"
                />
              </div>

              <select className="rounded-xl border border-gray-200/80 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/70">
                <option>Alle categorieën</option>
                <option>Organiseren</option>
                <option>Meedoen</option>
                <option>Zelfvertrouwen</option>
                <option>Autonomie</option>
                <option>Projectproces</option>
                <option>Eindresultaat</option>
                <option>Communicatie</option>
              </select>

              <select className="rounded-xl border border-gray-200/80 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/70">
                <option>Alle eindtermen</option>
                <option>Domein A – Vaardig handelen</option>
                <option>Domein C – Denkwijzen</option>
                <option>Domein F – Zelfregulatie</option>
              </select>
            </div>
          </div>

          {/* LAYOUT: sidebar (weergave) + content */}
          <div className="flex gap-4 md:gap-6">
            {/* LOKALE SIDEBAR: weergave voor dit project */}
            <aside className="w-64 shrink-0 space-y-4">
              <div className="rounded-xl bg-white border border-gray-200/80 shadow-sm p-2">
                <p className="px-2 pt-1 pb-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Weergave
                </p>
                <div className="flex flex-col gap-1">
                  <SidebarTab
                    label="Project"
                    description="Projectbrede aantekeningen"
                    active={activeTab === "project"}
                    onClick={() => setActiveTab("project")}
                  />
                  <SidebarTab
                    label="Teams"
                    description="Checklists, snelnotities & observaties per team"
                    active={activeTab === "teams"}
                    onClick={() => setActiveTab("teams")}
                  />
                  <SidebarTab
                    label="Leerlingen"
                    description="Individuele dossiers & competentiebewijs"
                    active={activeTab === "students"}
                    onClick={() => setActiveTab("students")}
                  />
                  <SidebarTab
                    label="Tijdlijn"
                    description="Chronologisch logboek van alle observaties"
                    active={activeTab === "timeline"}
                    onClick={() => setActiveTab("timeline")}
                  />
                </div>
              </div>

              {/* Teams als dropdown */}
              <div className="rounded-xl bg-white border border-gray-200/80 shadow-sm p-3">
                <p className="px-1 text-xs uppercase tracking-[0.16em] text-slate-500 mb-2">Teamselectie</p>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-500"
                  value={selectedTeamId}
                  onChange={(e) => handleSelectTeam(Number(e.target.value))}
                >
                  {TEAMS.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Leerlingenlijst in sidebar */}
              <div className="rounded-xl bg-white border border-gray-200/80 shadow-sm p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 px-1 mb-2">
                  Leerlingen in dit project
                </p>
                <div className="flex flex-col gap-1.5">
                  {selectedTeam.members.map((m) => (
                    <button
                      key={m}
                      onClick={() => handleSelectStudent(m)}
                      className={`w-full text-left rounded-xl px-3 py-2 text-xs transition border ${
                        selectedStudentName === m
                          ? "bg-slate-900 text-slate-50 border-slate-900 shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      <p className="font-medium text-[13px]">{m}</p>
                      <p className="text-[11px] opacity-80">{selectedTeam.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* CONTENT: aantekeningen-secties */}
            <section className="flex-1 space-y-4 md:space-y-6">
              {activeTab === "project" && <ProjectNotesCard />}

              {activeTab === "teams" && (
                <TeamNotesCard
                  team={selectedTeam}
                  quickNoteText={quickNoteText}
                  onQuickNoteTextChange={setQuickNoteText}
                  onQuickNoteClick={handleQuickNoteClick}
                  onSelectStudent={handleSelectStudent}
                />
              )}

              {activeTab === "students" && (
                <StudentNotesCard
                  selectedStudentName={selectedStudentName}
                  selectedTeam={selectedTeam}
                />
              )}

              {activeTab === "timeline" && <TimelineCard />}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
