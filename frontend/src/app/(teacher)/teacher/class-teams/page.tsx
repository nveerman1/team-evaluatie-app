"use client";

import { useState, useEffect } from "react";
import { Course } from "@/dtos/course.dto";
import { User } from "@/dtos/user.dto";
import CourseSelector from "@/components/CourseSelector";

// ============ Types ============

type ClassInfo = {
  name: string;
  color: string;
};

type TeamInfo = {
  number: number;
  name: string;
  color: string;
  memberCount: number;
};

type StudentRow = {
  id: number;
  name: string;
  email: string;
  class_name: string;
  team_number: number | null;
};

// ============ Constants ============

const TEAM_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-300",
  "bg-green-100 text-green-800 border-green-300",
  "bg-purple-100 text-purple-800 border-purple-300",
  "bg-orange-100 text-orange-800 border-orange-300",
  "bg-pink-100 text-pink-800 border-pink-300",
  "bg-indigo-100 text-indigo-800 border-indigo-300",
  "bg-red-100 text-red-800 border-red-300",
  "bg-yellow-100 text-yellow-800 border-yellow-300",
  "bg-teal-100 text-teal-800 border-teal-300",
  "bg-cyan-100 text-cyan-800 border-cyan-300",
];

const CLASS_COLORS = [
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-800",
  "bg-violet-100 text-violet-800",
  "bg-rose-100 text-rose-800",
];

// ============ Main Component ============

export default function ClassTeamsPage() {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);

  // Derived data
  const classes = Array.from(new Set(students.map((s) => s.class_name).filter(Boolean)));
  const teams = extractTeams(students);

  useEffect(() => {
    if (selectedCourse) {
      loadStudents();
    }
  }, [selectedCourse]);

  const loadStudents = async () => {
    if (!selectedCourse) return;

    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/v1/courses/${selectedCourse.id}/students`);
      // const data = await response.json();
      // setStudents(data.students);

      // Mock data for demo
      const mockStudents: StudentRow[] = [
        { id: 1, name: "Emma de Vries", email: "emma.devries@school.nl", class_name: "5V1", team_number: 1 },
        { id: 2, name: "Liam Jansen", email: "liam.jansen@school.nl", class_name: "5V1", team_number: 1 },
        { id: 3, name: "Sophie Bakker", email: "sophie.bakker@school.nl", class_name: "5V1", team_number: 2 },
        { id: 4, name: "Noah van Dam", email: "noah.vandam@school.nl", class_name: "5V1", team_number: 2 },
        { id: 5, name: "Olivia Visser", email: "olivia.visser@school.nl", class_name: "5V2", team_number: 3 },
        { id: 6, name: "Lucas Smit", email: "lucas.smit@school.nl", class_name: "5V2", team_number: 3 },
        { id: 7, name: "Mila Mulder", email: "mila.mulder@school.nl", class_name: "5V2", team_number: null },
        { id: 8, name: "Finn de Groot", email: "finn.degroot@school.nl", class_name: "5V2", team_number: null },
        { id: 9, name: "Tess Boer", email: "tess.boer@school.nl", class_name: "5V1", team_number: null },
        { id: 10, name: "Sem Peters", email: "sem.peters@school.nl", class_name: "5V1", team_number: 1 },
      ];
      
      setStudents(mockStudents);
      
      // Auto-select all classes
      setSelectedClasses(new Set(mockStudents.map(s => s.class_name).filter(Boolean)));
    } catch (error) {
      console.error("Failed to load students:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTeamChange = (studentId: number, teamNumber: number | null) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, team_number: teamNumber } : s))
    );
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = async () => {
    if (!selectedCourse) return;

    try {
      // TODO: Implement backend bulk update
      // await fetch(`/api/v1/courses/${selectedCourse.id}/students/bulk-update`, {
      //   method: 'PATCH',
      //   body: JSON.stringify({ students: students.map(s => ({ id: s.id, team_number: s.team_number })) })
      // });

      // Mock save
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      setHasUnsavedChanges(false);
      alert("✅ Wijzigingen succesvol opgeslagen!");
    } catch (error) {
      console.error("Failed to save changes:", error);
      alert("❌ Kon wijzigingen niet opslaan. Probeer het opnieuw.");
    }
  };

  const handleAutoBalance = () => {
    if (!confirm("Wil je alle niet-toegewezen studenten automatisch verdelen over de bestaande teams?")) {
      return;
    }

    const unassigned = students.filter((s) => s.team_number === null);
    const existingTeams = teams.map((t) => t.number);

    if (existingTeams.length === 0) {
      alert("Maak eerst een team aan voordat je studenten kunt toewijzen.");
      return;
    }

    let teamIndex = 0;
    const updated = students.map((student) => {
      if (student.team_number === null) {
        const assignedTeam = existingTeams[teamIndex % existingTeams.length];
        teamIndex++;
        return { ...student, team_number: assignedTeam };
      }
      return student;
    });

    setStudents(updated);
    setHasUnsavedChanges(true);
  };

  const handleClearAllTeams = () => {
    if (!confirm("Weet je zeker dat je alle teamtoewijzingen wilt verwijderen?")) {
      return;
    }

    setStudents((prev) => prev.map((s) => ({ ...s, team_number: null })));
    setHasUnsavedChanges(true);
  };

  const handleAddTeam = (teamNumber: number, teamName: string) => {
    // Team is automatically created when assigning first student
    // Just close the modal
    setShowAddTeamModal(false);
  };

  const handleClassToggle = (className: string) => {
    setSelectedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(className)) {
        next.delete(className);
      } else {
        next.add(className);
      }
      return next;
    });
  };

  const handleExportCSV = () => {
    if (students.length === 0) {
      alert("Geen studenten om te exporteren");
      return;
    }

    // Generate CSV content
    const headers = ["Naam", "Email", "Klas", "Teamnummer"];
    const rows = students.map(s => [
      s.name,
      s.email,
      s.class_name,
      s.team_number?.toString() || ""
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `teams_${selectedCourse?.code || "export"}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = () => {
    // Create file input
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const lines = text.split("\n");
          
          // Skip header
          const dataLines = lines.slice(1).filter(line => line.trim());
          
          // Parse CSV and update team numbers
          const updates: { [email: string]: number | null } = {};
          dataLines.forEach(line => {
            const parts = line.split(",").map(p => p.replace(/^"|"$/g, "").trim());
            if (parts.length >= 4) {
              const email = parts[1];
              const teamNumber = parts[3] ? parseInt(parts[3]) : null;
              updates[email] = teamNumber;
            }
          });

          // Apply updates
          setStudents(prev => prev.map(s => ({
            ...s,
            team_number: updates[s.email] !== undefined ? updates[s.email] : s.team_number
          })));
          
          setHasUnsavedChanges(true);
          alert(`✅ CSV geïmporteerd! ${Object.keys(updates).length} studenten bijgewerkt.`);
        } catch (error) {
          console.error("CSV import error:", error);
          alert("❌ Fout bij importeren van CSV. Controleer het bestandsformaat.");
        }
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  };

  // Filter students
  const filteredStudents = students.filter((student) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !student.name.toLowerCase().includes(query) &&
        !student.email.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Class filter
    if (selectedClasses.size > 0 && !selectedClasses.has(student.class_name)) {
      return false;
    }

    // Unassigned filter
    if (showUnassignedOnly && student.team_number !== null) {
      return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Klas- &amp; Teambeheer
          </h1>
          <p className="mt-1 text-gray-600">
            Beheer klassen en wijs teamnummers toe aan studenten
          </p>
        </div>

        {/* Mock data notice */}
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/80 backdrop-blur-sm p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Demo modus - Mock data
              </p>
              <p className="mt-1 text-sm text-blue-700">
                Deze pagina gebruikt mock data voor UI testing. Wijzigingen worden lokaal opgeslagen. 
                Backend API moet nog geïmplementeerd worden voor permanente opslag.
              </p>
            </div>
          </div>
        </div>

        {/* Course selector */}
        <div className="mb-6">
          <CourseSelector
            selectedCourseId={selectedCourse?.id}
            onCourseChange={setSelectedCourse}
          />
        </div>

        {!selectedCourse ? (
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-200 p-8 text-center shadow-sm">
            <div className="mx-auto h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-900">
              Selecteer een vak
            </p>
            <p className="mt-1 text-gray-600">
              Kies eerst een vak om studenten en teams te beheren
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-4">
            {/* Sidebar - Filters & Teams */}
            <div className="lg:col-span-1 space-y-4">
              {/* Filters Card */}
              <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-200 p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
                
                {/* Search */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zoeken
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Naam of email..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Class filters */}
                {classes.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Klassen
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {classes.map((className, idx) => (
                        <button
                          key={className}
                          onClick={() => handleClassToggle(className)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            selectedClasses.has(className)
                              ? CLASS_COLORS[idx % CLASS_COLORS.length]
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {className}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Show unassigned only */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showUnassignedOnly}
                      onChange={(e) => setShowUnassignedOnly(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      Alleen zonder team
                    </span>
                  </label>
                </div>
              </div>

              {/* Teams Card */}
              <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Teams</h3>
                  <button
                    onClick={() => setShowAddTeamModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Nieuw
                  </button>
                </div>

                {teams.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Nog geen teams
                  </p>
                ) : (
                  <div className="space-y-2">
                    {teams.map((team) => (
                      <div
                        key={team.number}
                        className={`px-3 py-2 rounded-lg border ${team.color} flex items-center justify-between`}
                      >
                        <div>
                          <div className="font-medium text-sm">{team.name}</div>
                          <div className="text-xs opacity-75">Team {team.number}</div>
                        </div>
                        <div className="text-sm font-semibold">
                          {team.memberCount}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions Card */}
              <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-200 p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Acties</h3>
                <div className="space-y-2">
                  <button
                    onClick={handleAutoBalance}
                    disabled={teams.length === 0}
                    className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
                  >
                    🔄 Auto-verdelen
                  </button>
                  <button
                    onClick={handleClearAllTeams}
                    className="w-full rounded-lg bg-white border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    🗑️ Wis alle teams
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="w-full rounded-lg bg-white border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    📥 Exporteer CSV
                  </button>
                  <button
                    onClick={handleImportCSV}
                    className="w-full rounded-lg bg-white border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    📤 Importeer CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Main content - Students table */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-200 shadow-sm">
                {/* Table header with actions */}
                <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Studenten
                    </h2>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {filteredStudents.length} {filteredStudents.length === 1 ? "student" : "studenten"}
                    </p>
                  </div>
                  
                  {hasUnsavedChanges && (
                    <button
                      onClick={handleSaveChanges}
                      className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-6 py-2.5 font-medium text-white hover:from-green-600 hover:to-green-700 transition-all shadow-sm hover:shadow flex items-center gap-2"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Opslaan
                    </button>
                  )}
                </div>

                {/* Loading state */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
                  </div>
                ) : (
                  <>
                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50/50">
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                              Naam
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                              Email
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                              Klas
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                              Team
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {filteredStudents.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-6 py-12 text-center">
                                <div className="text-gray-500">
                                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                  </svg>
                                  <p className="text-sm font-medium">Geen studenten gevonden</p>
                                  <p className="text-sm">Pas je filters aan of voeg studenten toe</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredStudents.map((student) => (
                              <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="font-medium text-gray-900">{student.name}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-gray-600">{student.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    CLASS_COLORS[classes.indexOf(student.class_name) % CLASS_COLORS.length]
                                  }`}>
                                    {student.class_name}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <select
                                    value={student.team_number ?? ""}
                                    onChange={(e) =>
                                      handleTeamChange(
                                        student.id,
                                        e.target.value ? parseInt(e.target.value) : null
                                      )
                                    }
                                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                                      student.team_number
                                        ? TEAM_COLORS[(student.team_number - 1) % TEAM_COLORS.length]
                                        : "border-gray-300 bg-white text-gray-700"
                                    }`}
                                  >
                                    <option value="">Geen team</option>
                                    {teams.map((team) => (
                                      <option key={team.number} value={team.number}>
                                        Team {team.number}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Team Modal */}
        {showAddTeamModal && (
          <AddTeamModal
            existingTeams={teams}
            onClose={() => setShowAddTeamModal(false)}
            onAdd={handleAddTeam}
          />
        )}
      </div>
    </div>
  );
}

// ============ Helper Functions ============

function extractTeams(students: StudentRow[]): TeamInfo[] {
  const teamMap = new Map<number, { name: string; count: number }>();

  students.forEach((student) => {
    if (student.team_number !== null) {
      const existing = teamMap.get(student.team_number);
      if (existing) {
        existing.count++;
      } else {
        teamMap.set(student.team_number, {
          name: `Team ${student.team_number}`,
          count: 1,
        });
      }
    }
  });

  return Array.from(teamMap.entries())
    .map(([number, { name, count }]) => ({
      number,
      name,
      color: TEAM_COLORS[(number - 1) % TEAM_COLORS.length],
      memberCount: count,
    }))
    .sort((a, b) => a.number - b.number);
}

// ============ Add Team Modal ============

function AddTeamModal({
  existingTeams,
  onClose,
  onAdd,
}: {
  existingTeams: TeamInfo[];
  onClose: () => void;
  onAdd: (teamNumber: number, teamName: string) => void;
}) {
  const [teamNumber, setTeamNumber] = useState<number>(
    existingTeams.length > 0
      ? Math.max(...existingTeams.map((t) => t.number)) + 1
      : 1
  );
  const [teamName, setTeamName] = useState(`Team ${teamNumber}`);

  useEffect(() => {
    setTeamName(`Team ${teamNumber}`);
  }, [teamNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (existingTeams.some((t) => t.number === teamNumber)) {
      alert("Dit teamnummer bestaat al. Kies een ander nummer.");
      return;
    }

    onAdd(teamNumber, teamName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">
          Nieuw team toevoegen
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Teamnummer *
            </label>
            <input
              type="number"
              min="1"
              required
              value={teamNumber}
              onChange={(e) => setTeamNumber(parseInt(e.target.value) || 1)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Teamnaam *
            </label>
            <input
              type="text"
              required
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="bijv. Team Alpha, Team 1, etc."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Annuleren
            </button>
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 font-medium text-white hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm hover:shadow"
            >
              Team toevoegen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
