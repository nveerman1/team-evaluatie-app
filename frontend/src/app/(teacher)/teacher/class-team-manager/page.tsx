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

type StudentRow = {
  id: number;
  name: string;
  email: string;
  class_name: string;
  team_number: number | null;
  isModified?: boolean; // Track if this row has been changed
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
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

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

  // Extract available team numbers
  const availableTeams = useMemo(() => {
    const teamSet = new Set(students.map((s) => s.team_number).filter((t) => t !== null));
    return Array.from(teamSet).sort((a, b) => a! - b!);
  }, [students]);

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

  // Check for unsaved changes and mark modified rows
  useEffect(() => {
    const updatedStudents = students.map((student) => {
      const original = originalStudents.find((s) => s.id === student.id);
      return {
        ...student,
        isModified: original && original.team_number !== student.team_number,
      };
    });
    setStudents(updatedStudents);
    
    const hasChanges = students.some((student, idx) => {
      return student.team_number !== originalStudents[idx]?.team_number;
    });
    setHasUnsavedChanges(hasChanges);
  }, [students.map(s => `${s.id}-${s.team_number}`).join(',')]);

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

  const handleStartEdit = (student: StudentRow) => {
    setEditingStudentId(student.id);
    setEditingValue(student.team_number?.toString() || "");
  };

  const handleSaveEdit = (studentId: number) => {
    const newValue = editingValue.trim() === "" ? null : parseInt(editingValue, 10);
    if (newValue !== null && (isNaN(newValue) || newValue < 1)) {
      showAlert("Teamnummer moet een positief getal zijn.", "error");
      return;
    }
    handleTeamChange(studentId, newValue);
    setEditingStudentId(null);
    setEditingValue("");
  };

  const handleCancelEdit = () => {
    setEditingStudentId(null);
    setEditingValue("");
  };

  const handleAddTeam = () => {
    setShowAddTeamModal(true);
  };

  const handleAutoBalance = () => {
    if (availableTeams.length === 0) {
      showAlert("Maak eerst teams aan voordat je studenten kunt verdelen.", "error");
      return;
    }

    const unassigned = students.filter((s) => s.team_number === null);
    if (unassigned.length === 0) {
      showAlert("Alle studenten zijn al ingedeeld.", "info");
      return;
    }

    const updated = [...students];

    unassigned.forEach((student, idx) => {
      const teamIdx = idx % availableTeams.length;
      const studentIdx = updated.findIndex((s) => s.id === student.id);
      if (studentIdx !== -1) {
        updated[studentIdx].team_number = availableTeams[teamIdx]!;
      }
    });

    setStudents(updated);
    showAlert(`${unassigned.length} studenten automatisch verdeeld over ${availableTeams.length} teams.`, "success");
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
            updatedStudents[studentIdx].team_number = teamNum ? parseInt(teamNum, 10) : null;
            updated++;
          }
        }
      });

      setStudents(updatedStudents);
      showAlert(`CSV geïmporteerd! ${updated} teamindelingen bijgewerkt.`, "success");
    };
    reader.readAsText(file);

    // Reset input
    event.target.value = "";
  };

  const showAlert = (message: string, type: "success" | "error" | "info") => {
    setAlertMessage(message);
    setAlertType(type);
    setTimeout(() => setAlertMessage(null), 5000);
  };

  // RBAC check
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Laden...</p>
        </div>
      </div>
    );
  }

  if (!isTeacher && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="max-w-md mx-auto px-6 py-8 bg-white rounded-2xl shadow-lg">
          <div className="text-center mb-4">
            <span className="text-4xl">🔒</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Geen toegang</h2>
          <p className="text-gray-600 mb-6 text-center">
            Je hebt geen toegang tot deze pagina. Alleen docenten en admins kunnen klas- en teambeheer gebruiken.
          </p>
          <a
            href="/teacher/courses"
            className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-center"
          >
            Terug naar vakken
          </a>
        </div>
      </div>
    );
  }

  if (!selectedCourse) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="text-4xl mb-4">📚</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Selecteer een vak</h2>
            <p className="text-gray-600 mb-6">
              Kies een vak om de klas- en teamindeling te beheren.
            </p>
            <CourseSelector
              courses={[MOCK_COURSE]} // TODO: Fetch based on role
              selectedCourseId={null}
              onCourseChange={handleCourseChange}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Klas- & Teambeheer</h1>
              {isAdmin && (
                <span className="px-3 py-1 text-xs font-semibold bg-purple-100 text-purple-800 rounded-full">
                  Admin
                </span>
              )}
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

        {/* Main Content: Toolbar + Table */}
        <div className="bg-white rounded-2xl shadow-sm border">
          {/* Sticky Toolbar */}
          <div className="sticky top-0 z-10 bg-white border-b rounded-t-2xl">
            <div className="p-4">
              {/* First row: Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="text"
                    placeholder="Zoek op naam of email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Class toggles */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Klassen:</span>
                  {allClasses.map((classInfo) => (
                    <button
                      key={classInfo.name}
                      onClick={() => handleToggleClass(classInfo.name)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition ${
                        selectedClasses.includes(classInfo.name)
                          ? classInfo.color
                          : "bg-gray-100 text-gray-400 border-gray-200"
                      }`}
                    >
                      {classInfo.name}
                    </button>
                  ))}
                </div>

                {/* Unassigned only checkbox */}
                <label className="flex items-center gap-2 cursor-pointer ml-auto">
                  <input
                    type="checkbox"
                    checked={showUnassignedOnly}
                    onChange={(e) => setShowUnassignedOnly(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Alleen zonder team</span>
                </label>
              </div>

              {/* Second row: Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleAddTeam}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  + Nieuw team
                </button>
                <button
                  onClick={handleAutoBalance}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  🔄 Auto-verdeel
                </button>

                {/* Export CSV: only for teachers with feature flag enabled */}
                {(isAdmin || teacherCanImportExport) && (
                  <button
                    onClick={handleExportCSV}
                    className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    📥 Exporteer CSV
                  </button>
                )}

                {/* Save button (right-aligned) */}
                {hasUnsavedChanges && (
                  <button
                    onClick={handleSaveChanges}
                    className="ml-auto px-6 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                  >
                    💾 Opslaan
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Naam
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Klas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Teamnr
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      Geen studenten gevonden met de huidige filters.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => {
                    const classColor = allClasses.find((c) => c.name === student.class_name)?.color || "bg-gray-100 text-gray-800";
                    const isEditing = editingStudentId === student.id;

                    return (
                      <tr
                        key={student.id}
                        className={`hover:bg-gray-50 transition ${
                          student.isModified ? "bg-yellow-50" : ""
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-medium text-gray-900">{student.name}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{student.email}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${classColor}`}>
                            {student.class_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEdit(student.id);
                                  if (e.key === "Escape") handleCancelEdit();
                                }}
                                className="w-20 px-2 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveEdit(student.id)}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                ✓
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(student)}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                            >
                              {student.team_number || "-"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer with count */}
          <div className="px-6 py-3 bg-gray-50 border-t rounded-b-2xl">
            <p className="text-sm text-gray-600">
              {filteredStudents.length} van {students.length} studenten getoond
              {hasUnsavedChanges && <span className="ml-2 text-yellow-600 font-medium">• Niet-opgeslagen wijzigingen</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Modals (placeholders) */}
      {showAddTeamModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Nieuw team toevoegen</h3>
            <p className="text-sm text-gray-600 mb-4">
              Voer een teamnummer in. Wijs daarna studenten toe aan dit team via de tabel.
            </p>
            <input
              type="number"
              min="1"
              placeholder="Teamnummer (bijv. 4)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddTeamModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Annuleren
              </button>
              <button
                onClick={() => {
                  setShowAddTeamModal(false);
                  showAlert("Team toegevoegd! Wijs nu studenten toe.", "success");
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Toevoegen
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdminTeacherPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Docenten toewijzen (Admin)</h3>
            <p className="text-sm text-gray-600 mb-4">
              TODO: Implement teacher assignment panel with API integration.
            </p>
            <button
              onClick={() => setShowAdminTeacherPanel(false)}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}

      {showAdminImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Importeer leerlingen (Admin)</h3>
            <p className="text-sm text-gray-600 mb-4">
              TODO: Implement Somtoday OAuth2 import + CSV upload tabs.
            </p>
            <button
              onClick={() => setShowAdminImportModal(false)}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
