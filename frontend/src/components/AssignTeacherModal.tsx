"use client";

import { useState, useEffect } from "react";
import { User } from "@/dtos/user.dto";
import { TeacherCourseCreate } from "@/dtos/course.dto";

interface AssignTeacherModalProps {
  courseId: number;
  courseName: string;
  onClose: () => void;
  onSuccess: () => void;
  assignTeacher: (
    courseId: number,
    data: TeacherCourseCreate
  ) => Promise<any>;
}

export default function AssignTeacherModal({
  courseId,
  courseName,
  onClose,
  onSuccess,
  assignTeacher,
}: AssignTeacherModalProps) {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>([]);
  const [role, setRole] = useState<"teacher" | "coordinator">("teacher");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTeachers();
  }, []);

  useEffect(() => {
    // Filter teachers based on search term
    if (searchTerm.trim() === "") {
      setFilteredTeachers(teachers);
    } else {
      const filtered = teachers.filter(
        (teacher) =>
          teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          teacher.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredTeachers(filtered);
    }
  }, [searchTerm, teachers]);

  const loadTeachers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock data for now - in real implementation, this would be an API call
      // TODO: Implement GET /api/v1/users?role=teacher endpoint
      const mockTeachers: User[] = [
        {
          id: 1,
          school_id: 1,
          email: "teacher1@demo.school",
          name: "Jan de Vries",
          role: "teacher",
        },
        {
          id: 2,
          school_id: 1,
          email: "teacher2@demo.school",
          name: "Maria Jansen",
          role: "teacher",
        },
        {
          id: 3,
          school_id: 1,
          email: "teacher3@demo.school",
          name: "Piet van Dam",
          role: "teacher",
        },
      ];
      
      setTeachers(mockTeachers);
      setFilteredTeachers(mockTeachers);
    } catch (err) {
      console.error("Failed to load teachers:", err);
      setError("Kon docenten niet laden");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedTeacherIds.length === 0) {
      setError("Selecteer minimaal één docent");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Assign each teacher sequentially
      for (const teacherId of selectedTeacherIds) {
        await assignTeacher(courseId, {
          teacher_id: teacherId,
          role: role,
        });
      }
      onSuccess();
    } catch (err: any) {
      console.error("Failed to assign teacher:", err);
      setError(
        err?.response?.data?.detail ||
          "Kon docent(en) niet toewijzen. Probeer het opnieuw."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleTeacherToggle = (teacherId: number) => {
    setSelectedTeacherIds((prev) => {
      if (prev.includes(teacherId)) {
        return prev.filter((id) => id !== teacherId);
      } else {
        return [...prev, teacherId];
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            Docent toewijzen
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-gray-600">
          Wijs één of meerdere docenten toe aan <span className="font-semibold">{courseName}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Search input */}
          <div>
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700"
            >
              Zoek docent
            </label>
            <input
              id="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Zoek op naam of email..."
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Teacher list */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecteer docent(en) * ({selectedTeacherIds.length} geselecteerd)
            </label>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-md border border-gray-300">
                {filteredTeachers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    Geen docenten gevonden
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredTeachers.map((teacher) => (
                      <label
                        key={teacher.id}
                        className={`flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-gray-50 ${
                          selectedTeacherIds.includes(teacher.id) ? "bg-blue-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTeacherIds.includes(teacher.id)}
                          onChange={() => handleTeacherToggle(teacher.id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {teacher.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {teacher.email}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Role selection */}
          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-gray-700"
            >
              Rol *
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "teacher" | "coordinator")}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="teacher">Docent</option>
              <option value="coordinator">Coördinator</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Coördinatoren hebben extra rechten voor dit vak
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={submitting || selectedTeacherIds.length === 0}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Toewijzen..." : "Docent toewijzen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
