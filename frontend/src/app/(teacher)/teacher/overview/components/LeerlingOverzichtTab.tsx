"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, User, ExternalLink, Loader2 } from "lucide-react";
import { OverviewTab } from "@/components/student/dashboard/OverviewTab";
import type { EvaluationResult } from "@/dtos";
import { teacherStudentService } from "@/services/teacher-student.service";

type StudentOption = {
  id: number;
  name: string;
  class_name?: string | null;
  email: string;
};

type StudentOverviewData = {
  peerResults: EvaluationResult[];
  competencyProfile: Array<{ category: string; value: number }>;
  learningGoals: Array<{
    id: string;
    title: string;
    status: string;
    related?: string;
    since?: string;
  }>;
  reflections: Array<{
    id: string;
    title: string;
    type: string;
    date: string;
  }>;
  projectResults: Array<{
    id: string;
    project: string;
    meta?: string;
    opdrachtgever?: string;
    periode?: string;
    eindcijfer?: number;
    proces?: number;
    eindresultaat?: number;
    communicatie?: number;
  }>;
};

export default function LeerlingOverzichtTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<StudentOverviewData | null>(null);

  // Fetch students list on mount
  useEffect(() => {
    const fetchStudents = async () => {
      setIsLoadingStudents(true);
      try {
        const data = await teacherStudentService.listStudents();
        setStudents(data);
        setFilteredStudents(data);
      } catch (err) {
        console.error("Error fetching students:", err);
        setError("Kon leerlingen niet laden");
      } finally {
        setIsLoadingStudents(false);
      }
    };

    fetchStudents();
  }, []);

  // Filter students based on search query
  useEffect(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      setFilteredStudents(students);
      return;
    }

    const filtered = students.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        (s.class_name && s.class_name.toLowerCase().includes(query))
    );
    setFilteredStudents(filtered);
  }, [searchQuery, students]);

  // Fetch overview data when student is selected
  const fetchStudentOverview = useCallback(async (studentId: number) => {
    setIsLoadingData(true);
    setError(null);
    try {
      const data = await teacherStudentService.getStudentOverview(studentId);
      setOverviewData(data);
    } catch (err) {
      console.error("Error fetching student overview:", err);
      setError("Kon overzicht niet laden voor deze leerling");
      setOverviewData(null);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  const handleStudentSelect = (student: StudentOption) => {
    setSelectedStudent(student);
    setSearchQuery(student.name);
    setShowDropdown(false);
    fetchStudentOverview(student.id);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowDropdown(true);
    // Clear selection if search query is cleared
    if (!value.trim() && selectedStudent) {
      setSelectedStudent(null);
      setOverviewData(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Student selector bar */}
      <Card className="rounded-xl border-gray-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Zoek leerling op naam of klas..."
                  className="pl-10 pr-4"
                  disabled={isLoadingStudents}
                />
                {isLoadingStudents && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                )}
              </div>

              {/* Dropdown with filtered students */}
              {showDropdown && filteredStudents.length > 0 && !selectedStudent && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {filteredStudents.slice(0, 50).map((student) => (
                    <button
                      key={student.id}
                      onClick={() => handleStudentSelect(student)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                    >
                      <User className="h-4 w-4 text-gray-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate">{student.name}</div>
                        <div className="text-xs text-gray-500">
                          {student.class_name || "Geen klas"} • {student.email}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedStudent && (
              <Button variant="secondary" size="sm" className="rounded-lg whitespace-nowrap" asChild>
                <a href={`/student?student_id=${selectedStudent.id}`} target="_blank" rel="noopener noreferrer">
                  Open studentweergave <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {!selectedStudent && !isLoadingData && (
        <Card className="rounded-xl border-gray-200 bg-white shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <User className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Selecteer een leerling</h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              Kies een leerling om OMZA, competenties, leerdoelen, reflecties en projectbeoordelingen te bekijken.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoadingData && (
        <Card className="rounded-xl border-gray-200 bg-white shadow-sm">
          <CardContent className="p-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400 mb-4" />
            <p className="text-sm text-gray-600">Overzicht laden...</p>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {error && selectedStudent && !isLoadingData && (
        <Card className="rounded-xl border-red-200 bg-red-50 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Overview content */}
      {selectedStudent && overviewData && !isLoadingData && !error && (
        <OverviewTab
          peerResults={overviewData.peerResults}
          competencyProfile={overviewData.competencyProfile}
          learningGoals={overviewData.learningGoals}
          reflections={overviewData.reflections}
          projectResults={overviewData.projectResults}
        />
      )}
    </div>
  );
}
