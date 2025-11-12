"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Course } from "@/dtos/course.dto";
import { useAuth } from "@/hooks/useAuth";

// ============ Types ============

type StudentRow = {
  id: number;
  name: string;
  email: string;
  class_name: string;
  team_number: number | null;
  isModified?: boolean;
};

// ============ Constants ============

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

export default function AdminCourseTeamsPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [course, setCourse] = useState<Course | null>(MOCK_COURSE);
  const [students, setStudents] = useState<StudentRow[]>(MOCK_STUDENTS);
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

  // RBAC Guard: Only admins can access this page
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      showAlert("Geen toegang. Alleen admins kunnen deze pagina bekijken.", "error");
      setTimeout(() => router.push("/teacher/courses"), 2000);
    }
  }, [authLoading, isAdmin, router]);

  // TODO: Load course data from API
  useEffect(() => {
    if (courseId) {
      // TODO: Fetch course data
      // const data = await courseService.getCourse(parseInt(courseId));
      // setCourse(data);
    }
  }, [courseId]);

  // TODO: Load students from API
  useEffect(() => {
    if (courseId) {
      // TODO: Fetch students
      // const data = await courseService.getCourseStudents(parseInt(courseId));
      // setStudents(data);
    }
  }, [courseId]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !student.name.toLowerCase().includes(query) &&
          !student.email.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      if (selectedClasses.length > 0 && !selectedClasses.includes(student.class_name)) {
        return false;
      }

      if (showUnassignedOnly && student.team_number !== null) {
        return false;
      }

      return true;
    });
  }, [students, searchQuery, selectedClasses, showUnassignedOnly]);

  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = students.some((s) => s.isModified);
    setHasUnsavedChanges(hasChanges);
  }, [students]);

  const showAlert = (message: string, type: "success" | "error" | "info") => {
    setAlertMessage(message);
    setAlertType(type);
    setTimeout(() => setAlertMessage(null), 5000);
  };

  const handleClassToggle = (className: string) => {
    setSelectedClasses((prev) =>
      prev.includes(className) ? prev.filter((c) => c !== className) : [...prev, className]
    );
  };

  const startEdit = (student: StudentRow) => {
    setEditingStudentId(student.id);
    setEditingValue(student.team_number?.toString() || "");
  };

  const cancelEdit = () => {
    setEditingStudentId(null);
    setEditingValue("");
  };

  const saveEdit = () => {
    if (editingStudentId !== null) {
      const newTeamNumber = editingValue === "" ? null : parseInt(editingValue);
      setStudents((prev) =>
        prev.map((s) =>
          s.id === editingStudentId
            ? { ...s, team_number: newTeamNumber, isModified: true }
            : s
        )
      );
      setEditingStudentId(null);
      setEditingValue("");
    }
  };

  const handleSaveChanges = async () => {
    try {
      // TODO: Save to backend
      // await courseService.bulkUpdateStudentTeams(courseId, students);
      showAlert("Wijzigingen opgeslagen!", "success");
      setStudents((prev) => prev.map((s) => ({ ...s, isModified: false })));
    } catch (error) {
      showAlert("Fout bij opslaan wijzigingen", "error");
    }
  };

  const handleAutoBalance = () => {
    const unassigned = students.filter((s) => s.team_number === null);
    if (unassigned.length === 0) {
      showAlert("Geen studenten zonder team", "info");
      return;
    }

    const teams = [...new Set(students.map((s) => s.team_number).filter((t) => t !== null))];
    if (teams.length === 0) {
      showAlert("Maak eerst een team aan", "info");
      return;
    }

    const updatedStudents = [...students];
    unassigned.forEach((student, idx) => {
      const teamIndex = idx % teams.length;
      const studentIdx = updatedStudents.findIndex((s) => s.id === student.id);
      updatedStudents[studentIdx] = {
        ...updatedStudents[studentIdx],
        team_number: teams[teamIndex],
        isModified: true,
      };
    });

    setStudents(updatedStudents);
    showAlert(`${unassigned.length} studenten verdeeld over ${teams.length} teams`, "success");
  };

  const handleClearAll = () => {
    if (!confirm("Weet je zeker dat je alle teamtoewijzingen wilt wissen?")) return;

    setStudents((prev) =>
      prev.map((s) => ({ ...s, team_number: null, isModified: true }))
    );
    showAlert("Alle teamtoewijzingen gewist", "info");
  };

  const handleExportCSV = () => {
    const csv = [
      "Naam,Email,Klas,Teamnummer",
      ...students.map((s) =>
        `"${s.name}","${s.email}","${s.class_name}","${s.team_number || ""}"`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teams_${course?.code || "course"}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showAlert("CSV geëxporteerd", "success");
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").slice(1); // Skip header
      
      const updates: { email: string; teamNumber: number | null }[] = [];
      lines.forEach((line) => {
        if (!line.trim()) return;
        const [, email, , teamNumber] = line.split(",").map((s) => s.replace(/"/g, "").trim());
        updates.push({ email, teamNumber: teamNumber ? parseInt(teamNumber) : null });
      });

      setStudents((prev) =>
        prev.map((s) => {
          const update = updates.find((u) => u.email === s.email);
          return update ? { ...s, team_number: update.teamNumber, isModified: true } : s;
        })
      );

      showAlert(`${updates.length} studenten bijgewerkt uit CSV`, "success");
    };
    reader.readAsText(file);
    event.target.value = ""; // Reset input
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Alert */}
        {alertMessage && (
          <div
            className={`mb-4 rounded-lg p-4 ${
              alertType === "success"
                ? "bg-green-50 text-green-800"
                : alertType === "error"
                ? "bg-red-50 text-red-800"
                : "bg-blue-50 text-blue-800"
            }`}
          >
            {alertMessage}
          </div>
        )}

        {/* Header with Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/teacher/courses"
            className="mb-4 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Terug naar Vakken beheren
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">Klas- & Teambeheer</h1>
                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800">
                  Admin
                </span>
              </div>
              {course && (
                <p className="mt-1 text-gray-600">
                  {course.name} {course.code && `(${course.code})`} - {course.level} - Jaar {course.year}
                </p>
              )}
            </div>

            {/* Admin-only Controls */}
            <div className="flex gap-2">
              <Link
                href={`/teacher/courses/${courseId}`}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Beheer vak
              </Link>
              <button
                onClick={() => setShowAdminTeacherPanel(true)}
                className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Docenten toewijzen
              </button>
              <button
                onClick={() => setShowAdminImportModal(true)}
                className="rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
              >
                Importeer leerlingen
              </button>
            </div>
          </div>
        </div>

        {/* Demo Mode Notice */}
        <div className="mb-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
          <strong>🧪 Demo Modus:</strong> Deze pagina gebruikt mock data. Implementeer de volgende backend API endpoints:
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li><code>GET /api/v1/courses/{courseId}/students</code> - Haal studenten op</li>
            <li><code>PATCH /api/v1/courses/{courseId}/students/bulk-update</code> - Bulk update teams</li>
            <li><code>POST /api/v1/courses/{courseId}/students/import-csv</code> - Import via CSV</li>
            <li><code>POST /api/v1/integrations/somtoday/import/students</code> - Import via Somtoday</li>
          </ul>
        </div>

        {/* Sticky Toolbar */}
        <div className="sticky top-0 z-10 mb-6 space-y-4 rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
          {/* Row 1: Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek op naam of email..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              {allClasses.map((cls) => (
                <button
                  key={cls.name}
                  onClick={() => handleClassToggle(cls.name)}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                    selectedClasses.includes(cls.name)
                      ? cls.color
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {cls.name}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={showUnassignedOnly}
                onChange={(e) => setShowUnassignedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Alleen zonder team
            </label>
          </div>

          {/* Row 2: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddTeamModal(true)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              + Nieuw team
            </button>

            <button
              onClick={handleAutoBalance}
              className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              🔄 Auto-verdeel
            </button>

            <button
              onClick={handleClearAll}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              🗑️ Wis alle
            </button>

            <button
              onClick={handleExportCSV}
              className="rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
            >
              📥 Exporteer CSV
            </button>

            <label className="cursor-pointer rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50">
              📤 Importeer CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
              />
            </label>

            <div className="flex-1"></div>

            {hasUnsavedChanges && (
              <button
                onClick={handleSaveChanges}
                className="rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                💾 Opslaan
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Naam
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Klas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Teamnr
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    Geen studenten gevonden
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    className={`transition-colors hover:bg-gray-50 ${
                      student.isModified ? "bg-yellow-50" : ""
                    }`}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {student.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{student.email}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          allClasses.find((c) => c.name === student.class_name)?.color || ""
                        }`}
                      >
                        {student.class_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {editingStudentId === student.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="w-20 rounded border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={saveEdit}
                            className="rounded bg-green-600 px-2 py-1 text-white hover:bg-green-700"
                          >
                            ✓
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded bg-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-400"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(student)}
                          className="rounded border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-50"
                        >
                          {student.team_number || "-"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3 text-sm text-gray-600">
            <span>{filteredStudents.length} studenten</span>
            {hasUnsavedChanges && (
              <span className="font-medium text-orange-600">Niet-opgeslagen wijzigingen</span>
            )}
          </div>
        </div>

        {/* Add Team Modal */}
        {showAddTeamModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold">Nieuw team toevoegen</h3>
              <p className="text-sm text-gray-600">
                Teams worden automatisch aangemaakt wanneer je een student toewijst.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowAddTeamModal(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Sluiten
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Admin Teacher Panel Modal */}
        {showAdminTeacherPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold">Docenten toewijzen</h3>
              <div className="mb-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                <strong>TODO:</strong> Implementeer backend endpoints:
                <ul className="mt-2 list-inside list-disc">
                  <li><code>GET /api/v1/courses/{courseId}/teachers</code></li>
                  <li><code>POST /api/v1/courses/{courseId}/teachers</code></li>
                  <li><code>DELETE /api/v1/courses/{courseId}/teachers/{{teacherId}}</code></li>
                </ul>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowAdminTeacherPanel(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Sluiten
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Admin Import Modal */}
        {showAdminImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold">Leerlingen importeren</h3>
              <div className="mb-4 space-y-4">
                <div className="rounded-lg border-2 border-green-300 bg-green-50 p-4">
                  <h4 className="font-medium text-green-900">Via Somtoday</h4>
                  <p className="mt-1 text-sm text-green-700">
                    Koppel met Somtoday om leerlingen automatisch te importeren.
                  </p>
                  <div className="mt-2 text-sm text-green-800">
                    <strong>TODO:</strong> <code>POST /api/v1/integrations/somtoday/import/students</code>
                  </div>
                </div>

                <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4">
                  <h4 className="font-medium text-blue-900">Via CSV Upload</h4>
                  <p className="mt-1 text-sm text-blue-700">
                    Upload een CSV bestand met kolommen: Naam, Email, Klas
                  </p>
                  <div className="mt-2 text-sm text-blue-800">
                    <strong>TODO:</strong> <code>POST /api/v1/courses/{courseId}/students/import-csv</code>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowAdminImportModal(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Sluiten
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
