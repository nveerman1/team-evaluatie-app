"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Course } from "@/dtos/course.dto";
import { useAuth } from "@/hooks/useAuth";
import CourseSelector from "@/components/CourseSelector";
import { courseService } from "@/services/course.service";

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

// ============ Main Component ============

export default function ClassTeamsPage() {
  const searchParams = useSearchParams();
  const courseIdParam = searchParams?.get("course_id");
  const { user, isAdmin, isTeacher, loading: authLoading } = useAuth();

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<"success" | "error" | "info">("info");
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<"name" | "email" | "class_name" | "team_number" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Team colors for visual distinction
  const TEAM_COLORS = [
    "bg-blue-100 text-blue-800 border-blue-300",
    "bg-green-100 text-green-800 border-green-300",
    "bg-purple-100 text-purple-800 border-purple-300",
    "bg-pink-100 text-pink-800 border-pink-300",
    "bg-yellow-100 text-yellow-800 border-yellow-300",
    "bg-indigo-100 text-indigo-800 border-indigo-300",
    "bg-red-100 text-red-800 border-red-300",
    "bg-teal-100 text-teal-800 border-teal-300",
  ];

  // Extract unique classes
  const allClasses = useMemo(() => {
    const classSet = new Set(students.map((s) => s.class_name));
    return Array.from(classSet).map((className, idx) => ({
      name: className,
      color: CLASS_COLORS[idx % CLASS_COLORS.length],
    }));
  }, [students]);

  // Load course from URL parameter if present
  useEffect(() => {
    const loadCourseFromUrl = async () => {
      if (!courseIdParam) return;
      
      try {
        const courseId = parseInt(courseIdParam, 10);
        if (isNaN(courseId)) return;
        
        const course = await courseService.getCourse(courseId);
        setSelectedCourse(course);
      } catch (error) {
        console.error("Failed to load course from URL:", error);
        showAlert("Kon vak niet laden", "error");
      }
    };

    loadCourseFromUrl();
  }, [courseIdParam]);

  // Load students when course is selected
  useEffect(() => {
    const loadStudents = async () => {
      if (!selectedCourse) {
        setStudents([]);
        return;
      }

      setLoading(true);
      try {
        const courseStudents = await courseService.getCourseStudents(selectedCourse.id);
        setStudents(
          courseStudents.map((s) => ({
            id: s.id,
            name: s.name,
            email: s.email,
            class_name: s.class_name || "",
            team_number: s.team_number,
          }))
        );
      } catch (error) {
        console.error("Failed to load students:", error);
        showAlert("Kon studenten niet laden", "error");
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [selectedCourse]);

  // Auto-select all classes on mount
  useEffect(() => {
    if (allClasses.length > 0 && selectedClasses.length === 0) {
      setSelectedClasses(allClasses.map((c) => c.name));
    }
  }, [allClasses, selectedClasses.length]);

  // Auto-save after 2 seconds of inactivity
  useEffect(() => {
    if (hasUnsavedChanges) {
      const timer = setTimeout(() => {
        handleSaveChanges();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [hasUnsavedChanges, students]);

  // RBAC Guard: Only teachers and admins can access
  useEffect(() => {
    if (!authLoading && !isAdmin && !isTeacher) {
      showAlert("Geen toegang. Alleen docenten en admins kunnen deze pagina bekijken.", "error");
    }
  }, [authLoading, isAdmin, isTeacher]);

  // Filter and sort students
  const filteredStudents = useMemo(() => {
    let filtered = students.filter((student) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase());

      // Class filter
      const matchesClass =
        selectedClasses.length === 0 || selectedClasses.includes(student.class_name);

      // Unassigned filter
      const matchesUnassigned = !showUnassignedOnly || student.team_number === null;

      return matchesSearch && matchesClass && matchesUnassigned;
    });

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];

        // Handle null values for team_number
        if (sortColumn === "team_number") {
          if (aVal === null && bVal === null) return 0;
          if (aVal === null) return sortDirection === "asc" ? 1 : -1;
          if (bVal === null) return sortDirection === "asc" ? -1 : 1;
        }

        // String comparison
        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortDirection === "asc" 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        // Number comparison
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        }

        return 0;
      });
    }

    return filtered;
  }, [students, searchQuery, selectedClasses, showUnassignedOnly, sortColumn, sortDirection]);

  const showAlert = (message: string, type: "success" | "error" | "info" = "info") => {
    setAlertMessage(message);
    setAlertType(type);
    setTimeout(() => setAlertMessage(null), 4000);
  };

  const handleClassToggle = (className: string) => {
    setSelectedClasses((prev) =>
      prev.includes(className) ? prev.filter((c) => c !== className) : [...prev, className]
    );
  };

  const handleStartEdit = (studentId: number, currentValue: number | null) => {
    setEditingStudentId(studentId);
    setEditingValue(currentValue !== null ? String(currentValue) : "");
  };

  const handleSaveEdit = (studentId: number) => {
    const newValue = editingValue === "" ? null : parseInt(editingValue, 10);
    
    if (editingValue !== "" && (isNaN(newValue!) || newValue! < 1)) {
      showAlert("Teamnummer moet een positief getal zijn", "error");
      return;
    }

    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, team_number: newValue, isModified: true } : s
      )
    );
    setEditingStudentId(null);
    setEditingValue("");
    setHasUnsavedChanges(true);
  };

  const handleCancelEdit = () => {
    setEditingStudentId(null);
    setEditingValue("");
  };

  const handleSaveChanges = async () => {
    if (!selectedCourse) return;
    
    try {
      const modifiedStudents = students.filter((s) => s.isModified);
      if (modifiedStudents.length === 0) return;

      const updates = modifiedStudents.map((s) => ({
        student_id: s.id,
        team_number: s.team_number,
      }));

      await courseService.bulkUpdateStudentTeams(selectedCourse.id, updates);
      
      showAlert("Wijzigingen automatisch opgeslagen", "success");
      setStudents((prev) => prev.map((s) => ({ ...s, isModified: false })));
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save changes:", error);
      showAlert("Kon wijzigingen niet opslaan", "error");
    }
  };

  const handleCreateTeams = () => {
    if (students.length === 0) {
      showAlert("Geen studenten om te verdelen", "info");
      return;
    }

    if (!confirm("Weet je zeker dat je alle studenten opnieuw wilt verdelen in teams van 4? Bestaande teams worden overschreven.")) {
      return;
    }

    // Shuffle students randomly
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    
    // Calculate number of teams needed
    const teamSize = 4;
    const numTeams = Math.ceil(shuffled.length / teamSize);
    
    // Assign team numbers
    const updated = shuffled.map((student, idx) => ({
      ...student,
      team_number: (idx % numTeams) + 1,
      isModified: true,
    }));

    setStudents(updated);
    setHasUnsavedChanges(true);
    showAlert(`${updated.length} studenten verdeeld over ${numTeams} teams`, "success");
  };

  const handleAutoBalance = () => {
    const unassigned = students.filter((s) => s.team_number === null);
    if (unassigned.length === 0) {
      showAlert("Geen studenten zonder team", "info");
      return;
    }

    const teamNumbers = Array.from(new Set(students.filter((s) => s.team_number !== null).map((s) => s.team_number!)));
    if (teamNumbers.length === 0) {
      showAlert("Geen bestaande teams om over te verdelen", "error");
      return;
    }

    teamNumbers.sort((a, b) => a - b);

    const updated = [...students];
    unassigned.forEach((student, idx) => {
      const teamIdx = idx % teamNumbers.length;
      const targetStudent = updated.find((s) => s.id === student.id);
      if (targetStudent) {
        targetStudent.team_number = teamNumbers[teamIdx];
        targetStudent.isModified = true;
      }
    });

    setStudents(updated);
    setHasUnsavedChanges(true);
    showAlert(`${unassigned.length} studenten verdeeld over ${teamNumbers.length} teams`, "success");
  };

  const handleOpenEditModal = (student: StudentRow) => {
    setEditingStudent({ ...student });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingStudent(null);
  };

  const handleSaveEditModal = () => {
    if (!editingStudent) return;

    setStudents((prev) =>
      prev.map((s) =>
        s.id === editingStudent.id
          ? { ...editingStudent, isModified: true }
          : s
      )
    );
    setHasUnsavedChanges(true);
    setShowEditModal(false);
    setEditingStudent(null);
    showAlert("Student gewijzigd", "success");
  };

  const handleOpenAddModal = () => {
    setEditingStudent({
      id: Date.now(), // Temporary ID
      name: "",
      email: "",
      class_name: "",
      team_number: null,
      isModified: true,
    });
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setEditingStudent(null);
  };

  const handleSaveAddModal = async () => {
    if (!editingStudent || !selectedCourse) return;

    if (!editingStudent.name || !editingStudent.email) {
      showAlert("Naam en email zijn verplicht", "error");
      return;
    }

    try {
      // Call API to add student to course
      const newStudent = await courseService.addStudentToCourse(selectedCourse.id, {
        name: editingStudent.name,
        email: editingStudent.email,
        class_name: editingStudent.class_name || undefined,
        team_number: editingStudent.team_number,
      });

      // Add to local state
      setStudents((prev) => [...prev, newStudent]);
      setShowAddModal(false);
      setEditingStudent(null);
      showAlert("Student succesvol toegevoegd aan vak", "success");
    } catch (error: any) {
      console.error("Failed to add student:", error);
      const errorMsg = error?.response?.data?.detail || "Kon student niet toevoegen";
      showAlert(errorMsg, "error");
    }
  };

  const handleDeleteStudent = (studentId: number) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    if (!confirm(`Weet je zeker dat je ${student.name} wilt verwijderen uit dit vak?`)) {
      return;
    }

    // Remove student from local state
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    showAlert("Student verwijderd (let op: deze wijziging is alleen lokaal)", "info");
  };

  const handleSort = (column: "name" | "email" | "class_name" | "team_number") => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleClearAll = () => {
    if (!confirm("Weet je zeker dat je alle teams wilt wissen? Deze actie kan niet ongedaan gemaakt worden.")) {
      return;
    }

    setStudents((prev) => prev.map((s) => ({ ...s, team_number: null, isModified: true })));
    setHasUnsavedChanges(true);
    showAlert("Alle teams gewist", "success");
  };

  const handleExportCSV = () => {
    const headers = ["Naam", "Email", "Klas", "Teamnummer"];
    const rows = students.map((s) => [
      s.name,
      s.email,
      s.class_name,
      s.team_number !== null ? String(s.team_number) : "",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `teams_${selectedCourse?.code || "export"}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    showAlert("CSV geëxporteerd", "success");
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());
      const dataLines = lines.slice(1); // Skip header

      let matchCount = 0;
      const updated = students.map((student) => {
        const matchingLine = dataLines.find((line) => {
          const cols = line.split(",").map((col) => col.replace(/^"|"$/g, ""));
          return cols[1] === student.email;
        });

        if (matchingLine) {
          const cols = matchingLine.split(",").map((col) => col.replace(/^"|"$/g, ""));
          const teamNum = cols[3] ? parseInt(cols[3], 10) : null;
          matchCount++;
          return { ...student, team_number: teamNum, isModified: true };
        }
        return student;
      });

      setStudents(updated);
      setHasUnsavedChanges(true);
      showAlert(`CSV geïmporteerd: ${matchCount} studenten gevonden`, "success");
    };
    reader.readAsText(file);
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-gray-600">Laden...</div>
      </div>
    );
  }

  if (!isAdmin && !isTeacher) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-lg bg-red-50 p-6 text-center">
          <p className="text-lg font-medium text-red-800">Geen toegang</p>
          <p className="mt-2 text-sm text-red-600">
            Alleen docenten en admins kunnen deze pagina bekijken.
          </p>
          <Link href="/teacher/courses" className="mt-4 inline-block text-blue-600 underline">
            Terug naar vakken
          </Link>
        </div>
      </div>
    );
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

        {/* Header */}
        <div className="mb-6">
          {isAdmin && courseIdParam && (
            <Link
              href="/teacher/courses"
              className="mb-4 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              ← Terug naar Vakken beheren
            </Link>
          )}
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Klas- & Teambeheer
                {isAdmin && (
                  <span className="ml-3 rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
                    Admin
                  </span>
                )}
              </h1>
              {selectedCourse && (
                <p className="mt-1 text-gray-600">
                  {selectedCourse.name} ({selectedCourse.code}) - {selectedCourse.level} jaar {selectedCourse.year}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Course Selector for Teachers (no courseId in URL) */}
        {isTeacher && !courseIdParam && (
          <div className="mb-6 rounded-lg bg-white p-4 shadow">
            <label className="mb-2 block text-sm font-medium text-gray-700">Selecteer vak</label>
            <CourseSelector
              onCourseChange={(course) => setSelectedCourse(course)}
              selectedCourseId={selectedCourse?.id}
            />
          </div>
        )}

        {!selectedCourse && (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <p className="text-gray-600">Selecteer een vak om te beginnen</p>
          </div>
        )}

        {selectedCourse && (
          <>
            {/* Sticky Toolbar */}
            <div className="sticky top-0 z-10 mb-6 space-y-4 rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur-sm">
              {/* Row 1: Filters */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="text"
                    placeholder="Zoek op naam of email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Class Filters */}
                <div className="flex flex-wrap gap-2">
                  {allClasses.map((classInfo) => (
                    <button
                      key={classInfo.name}
                      onClick={() => handleClassToggle(classInfo.name)}
                      className={`rounded-lg px-3 py-1 text-sm font-medium transition-all ${
                        selectedClasses.includes(classInfo.name)
                          ? classInfo.color
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {classInfo.name}
                    </button>
                  ))}
                </div>

                {/* Unassigned Only */}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showUnassignedOnly}
                    onChange={(e) => setShowUnassignedOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Alleen zonder team</span>
                </label>
              </div>

              {/* Row 2: Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleOpenAddModal}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  ➕ Leerling toevoegen
                </button>

                <button
                  onClick={handleCreateTeams}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  ✨ Teams maken
                </button>

                <button
                  onClick={handleAutoBalance}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  🔄 Auto-verdeel
                </button>

                <button
                  onClick={handleClearAll}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  🗑️ Wis alle teams
                </button>

                {isAdmin && (
                  <>
                    <button
                      onClick={handleExportCSV}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      📥 Exporteer CSV
                    </button>

                    <label className="cursor-pointer rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
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

            {/* Student Table */}
            <div className="overflow-hidden rounded-2xl bg-white shadow">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        onClick={() => handleSort("name")}
                        className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-1">
                          Naam
                          {sortColumn === "name" && (
                            <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort("email")}
                        className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-1">
                          Email
                          {sortColumn === "email" && (
                            <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort("class_name")}
                        className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-1">
                          Klas
                          {sortColumn === "class_name" && (
                            <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort("team_number")}
                        className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-1">
                          Teamnr
                          {sortColumn === "team_number" && (
                            <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Acties
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredStudents.map((student) => {
                      const classColor =
                        allClasses.find((c) => c.name === student.class_name)?.color || "bg-gray-100 text-gray-800";
                      const isEditing = editingStudentId === student.id;

                      return (
                        <tr
                          key={student.id}
                          className={`hover:bg-gray-50 ${student.isModified ? "bg-yellow-50" : ""}`}
                        >
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                            {student.name}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                            {student.email}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${classColor}`}>
                              {student.class_name}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="1"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleSaveEdit(student.id);
                                    }
                                    if (e.key === "Escape") {
                                      handleCancelEdit();
                                    }
                                    if (e.key === "Tab") {
                                      e.preventDefault();
                                      handleSaveEdit(student.id);
                                      // Find next student in filtered list
                                      const currentIndex = filteredStudents.findIndex(s => s.id === student.id);
                                      if (currentIndex < filteredStudents.length - 1) {
                                        const nextStudent = filteredStudents[currentIndex + 1];
                                        setTimeout(() => {
                                          handleStartEdit(nextStudent.id, nextStudent.team_number);
                                        }, 50);
                                      }
                                    }
                                  }}
                                  className="w-20 rounded border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveEdit(student.id)}
                                  className="rounded bg-green-600 px-2 py-1 text-white hover:bg-green-700"
                                  title="Opslaan"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="rounded bg-gray-600 px-2 py-1 text-white hover:bg-gray-700"
                                  title="Annuleren"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              student.team_number !== null ? (
                                <button
                                  onClick={() => handleStartEdit(student.id, student.team_number)}
                                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer hover:opacity-80 ${
                                    TEAM_COLORS[(student.team_number - 1) % TEAM_COLORS.length]
                                  }`}
                                >
                                  Team {student.team_number}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStartEdit(student.id, student.team_number)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  - (klik om toe te wijzen)
                                </button>
                              )
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleOpenEditModal(student)}
                                className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700"
                                title="Bewerken"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(student.id)}
                                className="rounded bg-red-600 px-2 py-1 text-white hover:bg-red-700"
                                title="Verwijderen"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3">
                <p className="text-sm text-gray-600">
                  {filteredStudents.length} van {students.length} studenten
                  {hasUnsavedChanges && <span className="ml-2 text-orange-600">(wijzigingen worden automatisch opgeslagen...)</span>}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Edit Student Modal */}
        {showEditModal && editingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-bold text-gray-900">Leerling bewerken</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Naam *</label>
                  <input
                    type="text"
                    value={editingStudent.name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email *</label>
                  <input
                    type="email"
                    value={editingStudent.email}
                    onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Klas</label>
                  <input
                    type="text"
                    value={editingStudent.class_name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, class_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Teamnummer</label>
                  <input
                    type="number"
                    min="1"
                    value={editingStudent.team_number || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, team_number: e.target.value ? parseInt(e.target.value) : null })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={handleCloseEditModal}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleSaveEditModal}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Opslaan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Student Modal */}
        {showAddModal && editingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-bold text-gray-900">Leerling toevoegen</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Naam *</label>
                  <input
                    type="text"
                    value={editingStudent.name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Volledige naam"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email *</label>
                  <input
                    type="email"
                    value={editingStudent.email}
                    onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="email@school.nl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Klas</label>
                  <input
                    type="text"
                    value={editingStudent.class_name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, class_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="bijv. 5V1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Teamnummer</label>
                  <input
                    type="number"
                    min="1"
                    value={editingStudent.team_number || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, team_number: e.target.value ? parseInt(e.target.value) : null })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Optioneel"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={handleCloseAddModal}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleSaveAddModal}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Toevoegen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
