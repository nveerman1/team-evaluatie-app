"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs } from "@/components";

type SetupStatus = "complete" | "partial" | "not_started";

type SetupInfo = {
  status: SetupStatus;
  label: string;
};

type BaseProject = {
  id: string;
  title: string;
  description: string;
  course: string;
  period: string;
  status: "Lopend" | "Startfase" | "Afgerond";
};

type Project = BaseProject & {
  client: string;
  contact?: string;
  dateRange: string;
  evaluation: SetupInfo;
  peer: SetupInfo;
  scan: SetupInfo;
  notesCount: number;
};

type ChoiceProject = BaseProject & {
  clients: string;
  totalSubprojects: number;
  evaluation: SetupInfo;
  peer: SetupInfo;
  scan: SetupInfo;
  notesCount: number;
};

type SubProject = {
  id: string;
  parentId: string;
  title: string;
  client: string;
  team: string;
  teamMembers: string[];
};

type FilterState = {
  search: string;
  course: string;
  status: string;
  period: string;
};

const SETUP_STATUS_STYLES: Record<SetupStatus, string> = {
  complete: "bg-green-400",
  partial: "bg-yellow-400",
  not_started: "bg-gray-300",
};

const FILTER_DEFAULTS: FilterState = {
  search: "",
  course: "",
  status: "",
  period: "",
};

const onderbouwProjects: Project[] = [
  {
    id: "wereldsteden",
    title: "Wereldsteden",
    description: "Ontwerpen van een paviljoen voor een wereldstad.",
    course: "O&O – H2C",
    client: "Gemeente Rotterdam",
    contact: "Contact: Marieke de Vries",
    period: "Periode 1",
    dateRange: "02-09-2025 – 18-10-2025",
    evaluation: { status: "complete", label: "1 beoordeling" },
    peer: { status: "partial", label: "1 peerevaluatie" },
    scan: { status: "not_started", label: "Scan inrichten" },
    notesCount: 6,
    status: "Lopend",
  },
  {
    id: "bruggenbouw",
    title: "Bruggenbouw",
    description: "Ontwerpen en testen van draagconstructies.",
    course: "O&O – H2B",
    client: "Arcadis",
    contact: "Contact: Richard Jansen",
    period: "Periode 2",
    dateRange: "04-11-2025 – 20-12-2025",
    evaluation: { status: "partial", label: "1 beoordeling" },
    peer: { status: "not_started", label: "Nog niet ingericht" },
    scan: { status: "not_started", label: "Scan inrichten" },
    notesCount: 2,
    status: "Startfase",
  },
  {
    id: "xplr-explorerweek",
    title: "XPLR Explorerweek",
    description: "Sprintproject met meerdere kleine challenges.",
    course: "XPLR – X2A",
    client: "Intern project",
    contact: "Geen externe opdrachtgever",
    period: "Periode 3",
    dateRange: "13-01-2026 – 31-01-2026",
    evaluation: { status: "not_started", label: "Nog niet ingericht" },
    peer: { status: "not_started", label: "Nog niet ingericht" },
    scan: { status: "not_started", label: "Scan inrichten" },
    notesCount: 0,
    status: "Startfase",
  },
];

const choiceProjects: ChoiceProject[] = [
  {
    id: "keuzeproject-1",
    title: "Keuzeproject 1 – Duurzame energie",
    description: "Leerlingen kiezen uit meerdere duurzame cases.",
    course: "O&O – V5E/V5N",
    clients:
      "Royal Roos, Dutch Wave Power, Gemeente Rotterdam + 1 intern project",
    totalSubprojects: 4,
    period: "Periode 1",
    evaluation: { status: "complete", label: "1 beoordeling" },
    peer: { status: "partial", label: "1 peerevaluatie" },
    scan: { status: "complete", label: "1 scan" },
    notesCount: 45,
    status: "Lopend",
  },
  {
    id: "keuzeproject-2",
    title: "Keuzeproject 2 – Smart mobility",
    description: "Projectlijn gericht op stedelijke mobiliteit.",
    course: "O&O – V5M",
    clients: "RET, Gemeente Rotterdam",
    totalSubprojects: 3,
    period: "Periode 2",
    evaluation: { status: "partial", label: "Beoordeling inrichten" },
    peer: { status: "not_started", label: "Nog niet ingericht" },
    scan: { status: "not_started", label: "Scan inrichten" },
    notesCount: 12,
    status: "Startfase",
  },
];

const subProjects: SubProject[] = [
  {
    id: "windturbine-redesign",
    parentId: "keuzeproject-1",
    title: "Windturbine redesign",
    client: "Royal Roos",
    team: "Team 3",
    teamMembers: ["Noor", "Iris", "Youssef"],
  },
  {
    id: "wave-energy-floater",
    parentId: "keuzeproject-1",
    title: "Wave energy floater",
    client: "Dutch Wave Power",
    team: "Team 1",
    teamMembers: ["Mees", "Lotte", "Daan"],
  },
  {
    id: "havenlogistiek",
    parentId: "keuzeproject-1",
    title: "Havenlogistiek",
    client: "Gemeente Rotterdam",
    team: "Team 4",
    teamMembers: ["Femke", "Jasper", "Milan"],
  },
  {
    id: "fietsinfrastructuur",
    parentId: "keuzeproject-2",
    title: "Fietsinfrastructuur",
    client: "Gemeente Rotterdam",
    team: "Team 2",
    teamMembers: ["Zoë", "Lars", "Eva"],
  },
  {
    id: "ov-data-analytics",
    parentId: "keuzeproject-2",
    title: "OV data analytics",
    client: "RET",
    team: "Team 1",
    teamMembers: ["Sven", "Romy", "Niels"],
  },
];

function applyFilters<T extends BaseProject>(
  items: T[],
  filters: FilterState,
): T[] {
  const searchTerm = filters.search.trim().toLowerCase();
  const normalizedCourse = filters.course.trim().toLowerCase();

  return items.filter((item) => {
    const matchesSearch = searchTerm
      ? [item.title, item.course, item.description]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(searchTerm))
      : true;

    const matchesCourse = normalizedCourse
      ? item.course.toLowerCase().includes(normalizedCourse)
      : true;
    const matchesStatus = filters.status
      ? item.status === filters.status
      : true;
    const matchesPeriod = filters.period
      ? item.period === filters.period
      : true;

    return matchesSearch && matchesCourse && matchesStatus && matchesPeriod;
  });
}

function StatusBullet({ status }: { status: SetupStatus }) {
  return (
    <span className={`h-2 w-2 rounded-full ${SETUP_STATUS_STYLES[status]}`} />
  );
}

function ProjectsFilters({
  filters,
  onChange,
  onReset,
}: {
  filters: FilterState;
  onChange: (key: keyof FilterState, value: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
      <input
        type="text"
        value={filters.search}
        onChange={(event) => onChange("search", event.target.value)}
        placeholder="Zoek op titel, Course (Vak)..."
        className="px-3 py-2 rounded-lg border w-64 text-sm"
      />
      <select
        value={filters.course}
        onChange={(event) => onChange("course", event.target.value)}
        className="px-3 py-2 rounded-lg border text-sm"
      >
        <option value="">Alle Courses (Vakken)</option>
        <option value="O&O">O&O</option>
        <option value="XPLR">XPLR</option>
      </select>
      <select
        value={filters.status}
        onChange={(event) => onChange("status", event.target.value)}
        className="px-3 py-2 rounded-lg border text-sm"
      >
        <option value="">Alle statussen</option>
        <option value="Lopend">Lopend</option>
        <option value="Startfase">Startfase</option>
        <option value="Afgerond">Afgerond</option>
      </select>
      <select
        value={filters.period}
        onChange={(event) => onChange("period", event.target.value)}
        className="px-3 py-2 rounded-lg border text-sm"
      >
        <option value="">Alle periodes</option>
        <option value="Periode 1">Periode 1</option>
        <option value="Periode 2">Periode 2</option>
        <option value="Periode 3">Periode 3</option>
        <option value="Periode 4">Periode 4</option>
      </select>
      <button
        type="button"
        onClick={onReset}
        className="px-3 py-2 text-sm rounded-lg border hover:bg-gray-50 ml-auto"
      >
        Reset
      </button>
    </div>
  );
}

function Legend() {
  return (
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
        Tip: gebruik de projectwizard om in één keer evaluaties, peer en scan
        aan een project te koppelen.
      </span>
    </div>
  );
}

function OnderbouwTable({ projects }: { projects: Project[] }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 space-y-3">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-gray-100 pb-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Onderbouw projecten
          </h2>
          <p className="text-xs text-gray-600">
            Projecten gekoppeld aan een specifieke{" "}
            <span className="font-medium">Course (Vak)</span> in de onderbouw.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span>Sorteren op</span>
          <select className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
            <option>Startdatum</option>
            <option>Course (Vak)</option>
            <option>Projectnaam</option>
          </select>
        </div>
      </header>

      <div className="overflow-x-auto text-xs">
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b border-gray-100 text-[11px] text-gray-500">
              <th className="py-2 pr-4">Project</th>
              <th className="px-4 py-2">Course (Vak)</th>
              <th className="px-4 py-2">Opdrachtgever</th>
              <th className="px-4 py-2">Periode</th>
              <th className="px-4 py-2">Evaluatie</th>
              <th className="px-4 py-2">Peer</th>
              <th className="px-4 py-2">Scan</th>
              <th className="px-4 py-2">Aantekeningen</th>
              <th className="px-4 py-2 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-gray-50">
                <td className="py-2 pr-4 align-top">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-900">
                      {project.title}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {project.description}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2 align-top text-[11px] text-gray-700">
                  {project.course}
                </td>
                <td className="px-4 py-2 align-top">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-800">
                      {project.client}
                    </span>
                    {project.contact && (
                      <span className="text-[11px] text-gray-400">
                        {project.contact}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 align-top text-[11px] text-gray-600">
                  {project.dateRange}
                </td>
                <td className="px-4 py-2 align-top">
                  <div className="flex items-center gap-1 text-[11px] text-gray-600">
                    <StatusBullet status={project.evaluation.status} />
                    <button className="underline-offset-2 hover:underline">
                      {project.evaluation.label}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-2 align-top">
                  <div className="flex items-center gap-1 text-[11px] text-gray-600">
                    <StatusBullet status={project.peer.status} />
                    <button className="underline-offset-2 hover:underline">
                      {project.peer.label}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-2 align-top">
                  <div className="flex items-center gap-1 text-[11px] text-gray-600">
                    <StatusBullet status={project.scan.status} />
                    <button className="underline-offset-2 hover:underline">
                      {project.scan.label}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-2 align-top">
                  <button className="text-[11px] text-gray-600 underline-offset-2 hover:underline">
                    {project.notesCount} aantekeningen
                  </button>
                </td>
                <td className="px-4 py-2 align-top text-right">
                  <button className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50">
                    Project openen →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BovenbouwTables({
  projects,
  subProjectList,
  selectedId,
  onSelect,
}: {
  projects: ChoiceProject[];
  subProjectList: SubProject[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selectedProject = projects.find((project) => project.id === selectedId);
  const filteredSubProjects = selectedProject
    ? subProjectList.filter(
        (subProject) => subProject.parentId === selectedProject.id,
      )
    : [];

  return (
    <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 space-y-4">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-gray-100 pb-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Bovenbouw keuzeprojecten
          </h2>
          <p className="text-xs text-gray-600">
            Centrale beoordeling per keuzeproject met gekoppelde peer en scan en
            inzicht in onderliggende deelprojecten.
          </p>
        </div>
      </header>

      <div className="overflow-x-auto text-xs">
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b border-gray-100 text-[11px] text-gray-500">
              <th className="py-2 pr-4">Keuzeproject</th>
              <th className="px-4 py-2">Course (Vak)</th>
              <th className="px-4 py-2"># deelprojecten</th>
              <th className="px-4 py-2">Opdrachtgever(s)</th>
              <th className="px-4 py-2">Periode</th>
              <th className="px-4 py-2">Evaluatie</th>
              <th className="px-4 py-2">Peer</th>
              <th className="px-4 py-2">Scan</th>
              <th className="px-4 py-2">Aantekeningen</th>
              <th className="px-4 py-2 text-right">Selectie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {projects.map((project) => {
              const isSelected = selectedProject?.id === project.id;

              return (
                <tr
                  key={project.id}
                  className={`${isSelected ? "bg-blue-50" : "hover:bg-gray-50"} cursor-pointer`}
                >
                  <td className="py-2 pr-4 align-top">
                    <button
                      type="button"
                      onClick={() => onSelect(project.id)}
                      className="flex flex-col text-left"
                    >
                      <span className="text-xs font-medium text-gray-900">
                        {project.title}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {project.description}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-2 align-top text-[11px] text-gray-700">
                    {project.course}
                  </td>
                  <td className="px-4 py-2 align-top text-[11px] text-gray-700">
                    {project.totalSubprojects} deelprojecten
                  </td>
                  <td className="px-4 py-2 align-top">
                    <div className="flex flex-col text-[11px] text-gray-700">
                      <span>{project.clients}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 align-top text-[11px] text-gray-600">
                    {project.period}
                  </td>
                  <td className="px-4 py-2 align-top">
                    <div className="flex items-center gap-1 text-[11px] text-gray-600">
                      <StatusBullet status={project.evaluation.status} />
                      <button className="underline-offset-2 hover:underline">
                        {project.evaluation.label}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 align-top">
                    <div className="flex items-center gap-1 text-[11px] text-gray-600">
                      <StatusBullet status={project.peer.status} />
                      <button className="underline-offset-2 hover:underline">
                        {project.peer.label}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 align-top">
                    <div className="flex items-center gap-1 text-[11px] text-gray-600">
                      <StatusBullet status={project.scan.status} />
                      <button className="underline-offset-2 hover:underline">
                        {project.scan.label}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 align-top">
                    <button className="text-[11px] text-gray-600 underline-offset-2 hover:underline">
                      {project.notesCount} aantekeningen
                    </button>
                  </td>
                  <td className="px-4 py-2 align-top text-right">
                    <button
                      type="button"
                      onClick={() => onSelect(project.id)}
                      className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50"
                    >
                      Selecteren
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedProject && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Deelprojecten – {selectedProject.title}
              </h3>
              <p className="text-xs text-gray-600">
                Deelprojecten gekoppeld aan{" "}
                <span className="font-medium">{selectedProject.title}</span>.
              </p>
            </div>
          </header>

          <div className="overflow-x-auto text-xs">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] text-gray-500">
                  <th className="py-2 pr-4">Deelproject</th>
                  <th className="px-4 py-2">Opdrachtgever</th>
                  <th className="px-4 py-2">Team</th>
                  <th className="px-4 py-2">Teamleden</th>
                  <th className="px-4 py-2 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSubProjects.map((subProject) => (
                  <tr key={subProject.id} className="hover:bg-white">
                    <td className="py-2 pr-4 align-top">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-900">
                          {subProject.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-[11px] text-gray-700">
                      {subProject.client}
                    </td>
                    <td className="px-4 py-2 align-top text-[11px] text-gray-700">
                      {subProject.team}
                    </td>
                    <td className="px-4 py-2 align-top text-[11px] text-gray-700">
                      {subProject.teamMembers.join(", ")}
                    </td>
                    <td className="px-4 py-2 align-top text-right">
                      <button className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50">
                        Open →
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredSubProjects.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-4 text-center text-[11px] text-gray-500"
                    >
                      Geen deelprojecten gevonden voor de huidige filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState<"onderbouw" | "bovenbouw">(
    "onderbouw",
  );
  const [filters, setFilters] = useState<FilterState>(FILTER_DEFAULTS);
  const [selectedChoiceProjectId, setSelectedChoiceProjectId] = useState<
    string | null
  >(null);

  const filteredOnderbouw = useMemo(
    () => applyFilters(onderbouwProjects, filters),
    [filters],
  );
  const filteredChoiceProjects = useMemo(
    () => applyFilters(choiceProjects, filters),
    [filters],
  );

  useEffect(() => {
    if (!filteredChoiceProjects.length) {
      setSelectedChoiceProjectId(null);
      return;
    }

    if (
      selectedChoiceProjectId &&
      !filteredChoiceProjects.some(
        (project) => project.id === selectedChoiceProjectId,
      )
    ) {
      setSelectedChoiceProjectId(null);
    }
  }, [filteredChoiceProjects, selectedChoiceProjectId]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters(FILTER_DEFAULTS);
  };

  const handleTabChange = (tabId: string) => {
    if (tabId === "onderbouw" || tabId === "bovenbouw") {
      setActiveTab(tabId);
    }
  };

  const tabs = [
    {
      id: "onderbouw",
      label: "Onderbouw",
      content: (
        <div className="space-y-4">
          <ProjectsFilters
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
          />
          <Legend />
          <OnderbouwTable projects={filteredOnderbouw} />
        </div>
      ),
    },
    {
      id: "bovenbouw",
      label: "Bovenbouw",
      content: (
        <div className="space-y-4">
          <ProjectsFilters
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
          />
          <Legend />
          <BovenbouwTables
            projects={filteredChoiceProjects}
            subProjectList={subProjects}
            selectedId={selectedChoiceProjectId}
            onSelect={setSelectedChoiceProjectId}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Projecten
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Overzicht van alle projecten per{" "}
              <span className="font-medium">Course (Vak)</span>, met gekoppelde
              evaluaties, peerevaluaties, competentiescans en aantekeningen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
              + Nieuw project
            </button>
            <button className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Projectwizard openen
            </button>
          </div>
        </header>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
      </div>
    </>
  );
}
