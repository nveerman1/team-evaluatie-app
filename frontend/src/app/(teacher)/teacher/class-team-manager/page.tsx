"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Course } from "@/dtos/course.dto";
import { User } from "@/dtos/user.dto";
import { useAuth } from "@/hooks/useAuth";
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
  editable?: boolean; // Admin can edit team names
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

// ============ Mock Data ============

const MOCK_STUDENTS: StudentRow[] = [
  { id: 1, name: "Emma de Vries", email: "emma.devries@school.nl", class_name: "5V1", team_number: 1 },
  { id: 2, name: "Liam Jansen", email: "liam.jansen@school.nl", class_name: "5V1", team_number: 1 },
  { id: 3, name: "Sophie Bakker", email: "sophie.bakker@school.nl", class_name: "5V1", team_number: 2 },
  { id: 4, name: "Noah van Dijk", email: "noah.vandijk@school.nl", class_name: "5V2", team_number: 2 },
  { id: 5, name: "Lisa Vermeulen", email: "lisa.vermeulen@school.nl", class_name: "5V2", team_number: 3 },
  { id: 6, name: "Tom de Jong", email: "tom.dejong@school.nl", class_name: "5V2", team_number: 3 },
  { id: 7, name: "Anna Smit", email: "anna.smit@school.nl", class_name: "5V1", team_number: null },
  { id: 8, name: "Max Peters", email: "max.peters@school.nl", class_name: "5V1", team_number: null },
  { id: 9, name: "Sarah Visser", email: "sarah.visser@school.nl", class_name: "5V2", team_number: null },
  { id: 10, name: "Lucas Berg", email: "lucas.berg@school.nl", class_name: "5V2", team_number: 1 },
];

const MOCK_COURSE: Course = {
  id: 1,
  school_id: 1,
  name: "Onderzoek & Ontwikkelen",
  code: "O&O",
  level: "VWO",
  year: 5,
  period: "Jaar",
  description: "Project-based learning course",
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ============ Main Component ============

export default function ClassTeamManagerPage() {
  const searchParams = useSearchParams();
  const courseIdParam = searchParams?.get("course_id");
  const { user, role, schoolId, isAdmin, isTeacher, loading: authLoading } = useAuth();

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<StudentRow[]>(MOCK_STUDENTS);
  const [originalStudents, setOriginalStudents] = useState<StudentRow[]>(MOCK_STUDENTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [showAdminTeacherPanel, setShowAdminTeacherPanel] = useState(false);
  const [showAdminImportModal, setShowAdminImportModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<"success" | "error" | "info">("info");

  // Feature flags
  const teacherCanImportExport = false; // Can be toggled via config

  // Extract unique classes
  const allClasses = useMemo(() => {
    const classSet = new Set(students.map((s) => s.class_name));
    return Array.from(classSet).map((className, idx) => ({
      name: className,
      color: CLASS_COLORS[idx % CLASS_COLORS.length],
    }));
  }, [students]);

  // Auto-select all classes on mount
  useEffect(() => {
    if (allClasses.length > 0 && selectedClasses.length === 0) {
      setSelectedClasses(allClasses.map((c) => c.name));
    }
  }, [allClasses, selectedClasses.length]);

  // Extract teams with counts
  const teams = useMemo(() => {
    const teamMap = new Map<number, TeamInfo>();
    students.forEach((student) => {
      if (student.team_number !== null) {
        if (!teamMap.has(student.team_number)) {
          teamMap.set(student.team_number, {
            number: student.team_number,
            name: `Team ${student.team_number}`,
            color: TEAM_COLORS[student.team_number % TEAM_COLORS.length],
            memberCount: 0,
            editable: isAdmin,
          });
        }
        const team = teamMap.get(student.team_number)!;
        team.memberCount++;
      }
    });
    return Array.from(teamMap.values()).sort((a, b) => a.number - b.number);
  }, [students, isAdmin]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
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
      if (selectedClasses.length > 0 && !selectedClasses.includes(student.class_name)) {
        return false;
      }

      // Unassigned filter
      if (showUnassignedOnly && student.team_number !== null) {
        return false;
      }

      return true;
    });
  }, [students, searchQuery, selectedClasses, showUnassignedOnly]);

  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = JSON.stringify(students) !== JSON.stringify(originalStudents);
    setHasUnsavedChanges(hasChanges);
  }, [students, originalStudents]);

  // Load course from URL param (mock for now)
  useEffect(() => {
    if (courseIdParam) {
      // TODO: Fetch course from API based on role
      // isAdmin ? /api/v1/courses/{id} : /api/v1/courses/{id}?assigned_to_me=true
      setSelectedCourse(MOCK_COURSE);
    }
  }, [courseIdParam, isAdmin]);

  // Handlers
  const handleCourseChange = (course: Course | null) => {
    setSelectedCourse(course);
    if (course) {
      // TODO: Fetch students for course
      // GET /api/v1/courses/{course.id}/students
      // For now, use mock data
      setStudents(MOCK_STUDENTS);
      setOriginalStudents(MOCK_STUDENTS);
    }
  };

  const handleTeamChange = (studentId: number, newTeamNumber: number | null) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, team_number: newTeamNumber } : s))
    );
  };

  const handleToggleClass = (className: string) => {
    setSelectedClasses((prev) =>
      prev.includes(className) ? prev.filter((c) => c !== className) : [...prev, className]
    );
  };

  const handleAddTeam = (teamNumber: number, teamName: string) => {
    // Team will be created automatically when first student is assigned
    setShowAddTeamModal(false);
    showAlert("Team toegevoegd! Wijs nu studenten toe aan dit team.", "success");
  };

  const handleAutoBalance = () => {
    if (teams.length === 0) {
      showAlert("Maak eerst teams aan voordat je studenten kunt verdelen.", "error");
      return;
    }

    const unassigned = students.filter((s) => s.team_number === null);
    if (unassigned.length === 0) {
      showAlert("Alle studenten zijn al ingedeeld.", "info");
      return;
    }

    const teamNumbers = teams.map((t) => t.number);
    const updated = [...students];

    unassigned.forEach((student, idx) => {
      const teamIdx = idx % teamNumbers.length;
      const studentIdx = updated.findIndex((s) => s.id === student.id);
      if (studentIdx !== -1) {
        updated[studentIdx].team_number = teamNumbers[teamIdx];
      }
    });

    setStudents(updated);
    showAlert(`${unassigned.length} studenten automatisch verdeeld over ${teams.length} teams.`, "success");
  };

  const handleClearAllTeams = () => {
    if (!confirm("Weet je zeker dat je alle teamindelingen wilt wissen?")) {
      return;
    }

    setStudents((prev) => prev.map((s) => ({ ...s, team_number: null })));
    showAlert("Alle teamindelingen gewist.", "success");
  };

  const handleSaveChanges = async () => {
    // TODO: PATCH /api/v1/courses/{courseId}/students/bulk-update
    // Body: { students: [{ id, team_number }, ...] }
    
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      setOriginalStudents([...students]);
      showAlert("Wijzigingen opgeslagen!", "success");
    } catch (error) {
      showAlert("Fout bij opslaan. Probeer het opnieuw.", "error");
    }
  };

  const handleExportCSV = () => {
    const csv = [
      ["Naam", "Email", "Klas", "Teamnummer"],
      ...students.map((s) => [s.name, s.email, s.class_name, s.team_number?.toString() || ""]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `teams_${selectedCourse?.code || "export"}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    showAlert("CSV geëxporteerd!", "success");
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").slice(1); // Skip header
      let updated = 0;

      const updatedStudents = [...students];
      lines.forEach((line) => {
        const match = line.match(/"([^"]+)","([^"]+)","([^"]+)","?(\d*)"?/);
        if (match) {
          const [, , email, , teamNum] = match;
          const studentIdx = updatedStudents.findIndex((s) => s.email === email);
          if (studentIdx !== -1) {
            updatedStudents[studentIdx].team_number = teamNum ? parseInt(teamNum) : null;
            updated++;
          }
        }
      });

      setStudents(updatedStudents);
      showAlert(`${updated} studenten geïmporteerd uit CSV.`, "success");
    };
    reader.readAsText(file);
  };

  const showAlert = (message: string, type: "success" | "error" | "info") => {
    setAlertMessage(message);
    setAlertType(type);
    setTimeout(() => setAlertMessage(null), 5000);
  };

  // RBAC guard: redirect if no access
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Laden...</div>
      </div>
    );
  }

  if (!isTeacher && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-sm border rounded-2xl shadow-sm p-8 max-w-md">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Geen toegang</h2>
          <p className="text-gray-600 mb-4">
            Je hebt geen rechten om deze pagina te bekijken. Neem contact op met je beheerder.
          </p>
          <a href="/teacher/courses" className="text-blue-600 hover:underline">
            ← Terug naar vakken
          </a>
        </div>
      </div>
    );
  }

  // Empty state: no course selected
  if (!selectedCourse) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">
                Klas- & Teambeheer
                {isAdmin && (
                  <span className="ml-3 text-sm font-medium px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
                    Admin
                  </span>
                )}
              </h1>
            </div>
            <p className="text-gray-600">Beheer klassen en teams per vak</p>
          </div>

          {/* Empty state */}
          <div className="bg-white/80 backdrop-blur-sm border rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Selecteer een vak</h3>
            <p className="text-gray-600 mb-6">
              Kies een vak om klassen en teams te beheren.
            </p>
            <CourseSelector
              courses={[MOCK_COURSE]} // TODO: Fetch courses based on role
              selectedCourseId={null}
              onCourseChange={handleCourseChange}
            />
          </div>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">
                Klas- & Teambeheer
                {isAdmin && (
                  <span className="ml-3 text-sm font-medium px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
                    Admin
                  </span>
                )}
              </h1>
            </div>

            {/* Admin-only controls */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <a
                  href={`/admin/courses/${selectedCourse.id}`}
                  className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Beheer vak
                </a>
                <button
                  onClick={() => setShowAdminTeacherPanel(true)}
                  className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Docenten toewijzen
                </button>
                <button
                  onClick={() => setShowAdminImportModal(true)}
                  className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Importeer leerlingen
                </button>
              </div>
            )}
          </div>

          {/* Course info */}
          <div className="bg-white/80 backdrop-blur-sm border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-blue-600">{selectedCourse.code}</span>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedCourse.name}</h2>
                  <span className="text-sm text-gray-500">
                    {selectedCourse.level} • {selectedCourse.year} • {selectedCourse.period}
                  </span>
                </div>
              </div>
              <CourseSelector
                courses={[MOCK_COURSE]} // TODO: Fetch based on role
                selectedCourseId={selectedCourse.id}
                onCourseChange={handleCourseChange}
              />
            </div>
          </div>
        </div>

        {/* Alert */}
        {alertMessage && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              alertType === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : alertType === "error"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            {alertMessage}
          </div>
        )}

        {/* Demo notice */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="text-2xl">ℹ️</div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Demo Modus</h3>
              <p className="text-sm text-blue-800">
                Deze pagina gebruikt mock data. Backend API's voor studenten en teams moeten nog geïmplementeerd worden:
                <code className="ml-1 text-xs bg-blue-100 px-2 py-1 rounded">
                  GET /api/v1/courses/{"{id}"}/students
                </code>
                {" en "}
                <code className="text-xs bg-blue-100 px-2 py-1 rounded">
                  PATCH /api/v1/courses/{"{id}"}/students/bulk-update
                </code>
              </p>
            </div>
          </div>
        </div>

        {/* Main layout: Sidebar + Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Filters */}
            <div className="bg-white/80 backdrop-blur-sm border rounded-2xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Filters</h3>

              {/* Search */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Zoeken</label>
                <input
                  type="text"
                  placeholder="Naam of email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Class toggles */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Klassen</label>
                <div className="flex flex-wrap gap-2">
                  {allClasses.map((classInfo) => (
                    <button
                      key={classInfo.name}
                      onClick={() => handleToggleClass(classInfo.name)}
                      className={`px-3 py-1 text-sm font-medium rounded-lg border transition ${
                        selectedClasses.includes(classInfo.name)
                          ? classInfo.color
                          : "bg-gray-100 text-gray-400 border-gray-200"
                      }`}
                    >
                      {classInfo.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unassigned only */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showUnassignedOnly}
                    onChange={(e) => setShowUnassignedOnly(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Alleen zonder team</span>
                </label>
              </div>
            </div>

            {/* Teams */}
            <div className="bg-white/80 backdrop-blur-sm border rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Teams</h3>
                <button
                  onClick={() => setShowAddTeamModal(true)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  + Nieuw
                </button>
              </div>

              {teams.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nog geen teams</p>
              ) : (
                <div className="space-y-2">
                  {teams.map((team) => (
                    <div
                      key={team.number}
                      className={`px-3 py-2 rounded-lg border ${team.color} flex items-center justify-between`}
                    >
                      <span className="font-medium text-sm">{team.name}</span>
                      <span className="text-xs font-semibold">{team.memberCount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-white/80 backdrop-blur-sm border rounded-2xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Acties</h3>
              <div className="space-y-2">
                <button
                  onClick={handleAutoBalance}
                  className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  🔄 Auto-verdeel oningedeeld
                </button>
                <button
                  onClick={handleClearAllTeams}
                  className="w-full px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  🗑️ Wis alle teams
                </button>
                {(isAdmin || teacherCanImportExport) && (
                  <>
                    <button
                      onClick={handleExportCSV}
                      className="w-full px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                    >
                      📥 Exporteer CSV
                    </button>
                    <label className="w-full px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition cursor-pointer block text-center">
                      📤 Importeer CSV
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleImportCSV}
                        className="hidden"
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3">
            <div className="bg-white/80 backdrop-blur-sm border rounded-2xl shadow-sm overflow-hidden">
              {/* Table header with save button */}
              <div className="px-6 py-4 border-b bg-gray-50/50 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Studenten ({filteredStudents.length})
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Selecteer een team per student via de dropdown
                  </p>
                </div>
                {hasUnsavedChanges && (
                  <button
                    onClick={handleSaveChanges}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                  >
                    💾 Opslaan ({students.filter((s, i) => s.team_number !== originalStudents[i].team_number).length} wijzigingen)
                  </button>
                )}
              </div>

              {/* Table */}
              {filteredStudents.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Geen studenten gevonden</h3>
                  <p className="text-gray-600">
                    Pas je filters aan of selecteer een andere klas.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Naam
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Klas
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Team
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredStudents.map((student) => {
                        const classColor = allClasses.find((c) => c.name === student.class_name)?.color;
                        const teamColor = student.team_number
                          ? TEAM_COLORS[student.team_number % TEAM_COLORS.length]
                          : "";

                        return (
                          <tr key={student.id} className="hover:bg-gray-50 transition">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{student.email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 text-xs font-medium rounded-full ${classColor}`}>
                                {student.class_name}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <select
                                value={student.team_number || ""}
                                onChange={(e) =>
                                  handleTeamChange(
                                    student.id,
                                    e.target.value ? parseInt(e.target.value) : null
                                  )
                                }
                                className={`px-3 py-1 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 ${
                                  student.team_number ? teamColor : "bg-gray-100 text-gray-400"
                                }`}
                              >
                                <option value="">Geen team</option>
                                {teams.map((team) => (
                                  <option key={team.number} value={team.number}>
                                    {team.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Team Modal */}
      {showAddTeamModal && (
        <AddTeamModal
          onClose={() => setShowAddTeamModal(false)}
          onAdd={handleAddTeam}
          existingTeams={teams}
        />
      )}

      {/* Admin Teacher Panel (placeholder) */}
      {showAdminTeacherPanel && (
        <AdminTeacherPanel
          courseId={selectedCourse.id}
          onClose={() => setShowAdminTeacherPanel(false)}
        />
      )}

      {/* Admin Import Modal (placeholder) */}
      {showAdminImportModal && (
        <AdminImportModal
          courseId={selectedCourse.id}
          onClose={() => setShowAdminImportModal(false)}
        />
      )}
    </div>
  );
}

// ============ Modals ============

function AddTeamModal({
  onClose,
  onAdd,
  existingTeams,
}: {
  onClose: () => void;
  onAdd: (number: number, name: string) => void;
  existingTeams: TeamInfo[];
}) {
  const [teamNumber, setTeamNumber] = useState(existingTeams.length + 1);
  const [teamName, setTeamName] = useState(`Team ${existingTeams.length + 1}`);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (existingTeams.some((t) => t.number === teamNumber)) {
      alert("Dit teamnummer bestaat al. Kies een ander nummer.");
      return;
    }
    onAdd(teamNumber, teamName);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Nieuw team toevoegen</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Teamnummer</label>
            <input
              type="number"
              min="1"
              value={teamNumber}
              onChange={(e) => setTeamNumber(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Teamnaam</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Annuleren
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Toevoegen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminTeacherPanel({ courseId, onClose }: { courseId: number; onClose: () => void }) {
  // TODO: Implement teacher assignment panel
  // GET /api/v1/courses/{courseId}/teachers
  // POST /api/v1/courses/{courseId}/teachers
  // DELETE /api/v1/courses/{courseId}/teachers/{teacherId}

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Docenten toewijzen</h2>
        <div className="p-8 bg-gray-50 rounded-xl text-center">
          <p className="text-gray-600 mb-4">
            Deze functie moet nog geïmplementeerd worden.
          </p>
          <p className="text-sm text-gray-500">
            Backend endpoints: GET/POST/DELETE /api/v1/courses/{courseId}/teachers
          </p>
        </div>
        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminImportModal({ courseId, onClose }: { courseId: number; onClose: () => void }) {
  // TODO: Implement student import (Somtoday OAuth + CSV upload)
  // POST /api/v1/integrations/somtoday/import/students
  // POST /api/v1/courses/{courseId}/students/import-csv

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Leerlingen importeren</h2>
        
        <div className="space-y-4">
          <div className="p-6 bg-blue-50 border border-blue-200 rounded-xl">
            <h3 className="font-semibold text-blue-900 mb-2">Via Somtoday</h3>
            <p className="text-sm text-blue-800 mb-4">
              Importeer leerlingen direct uit Somtoday via OAuth2.
            </p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Verbind met Somtoday
            </button>
          </div>

          <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl">
            <h3 className="font-semibold text-gray-900 mb-2">Via CSV</h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload een CSV bestand met kolommen: Naam, Email, Klas
            </p>
            <label className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition cursor-pointer inline-block">
              Kies bestand
              <input type="file" accept=".csv" className="hidden" />
            </label>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}
