"use client";

import { useState, useEffect, useRef } from "react";
import { User } from "@/dtos/user.dto";
import { TeacherCourseCreate } from "@/dtos/course.dto";
import { teacherService, Teacher } from "@/services/teacher.service";

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
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeachers, setSelectedTeachers] = useState<Teacher[]>([]);
  const [role, setRole] = useState<"teacher" | "coordinator">("teacher");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load teachers when search term changes
  useEffect(() => {
    const loadTeachers = async () => {
      if (searchTerm.length < 2) {
        setTeachers([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const response = await teacherService.listTeachers({
          search: searchTerm,
          status: "active",
          per_page: 20,
        });
        
        // Filter out already selected teachers
        const filtered = response.teachers.filter(
          (teacher) => !selectedTeachers.find((t) => t.id === teacher.id)
        );
        
        setTeachers(filtered);
      } catch (err) {
        console.error("Failed to load teachers:", err);
        setError("Kon docenten niet laden");
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(loadTeachers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedTeachers]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedTeachers.length === 0) {
      setError("Selecteer minimaal één docent");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Assign each teacher sequentially
      for (const teacher of selectedTeachers) {
        await assignTeacher(courseId, {
          teacher_id: teacher.id,
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

  const handleSelectTeacher = (teacher: Teacher) => {
    setSelectedTeachers((prev) => [...prev, teacher]);
    setSearchTerm("");
    setTeachers([]);
    setShowDropdown(false);
    searchInputRef.current?.focus();
  };

  const handleRemoveTeacher = (teacherId: number) => {
    setSelectedTeachers((prev) => prev.filter((t) => t.id !== teacherId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
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
          {/* Autocomplete search input */}
          <div className="relative">
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Zoek en selecteer docenten *
            </label>
            <input
              ref={searchInputRef}
              id="search"
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Type minimaal 2 karakters om te zoeken..."
              className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            
            {/* Dropdown with search results */}
            {showDropdown && searchTerm.length >= 2 && (
              <div
                ref={dropdownRef}
                className="absolute z-10 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg max-h-60 overflow-y-auto"
              >
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                  </div>
                ) : teachers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    Geen docenten gevonden
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {teachers.map((teacher) => (
                      <button
                        key={teacher.id}
                        type="button"
                        onClick={() => handleSelectTeacher(teacher)}
                        className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="font-medium text-gray-900">
                          {teacher.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {teacher.email}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected teachers */}
          {selectedTeachers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Geselecteerde docenten ({selectedTeachers.length})
              </label>
              <div className="space-y-2">
                {selectedTeachers.map((teacher) => (
                  <div
                    key={teacher.id}
                    className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {teacher.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {teacher.email}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTeacher(teacher.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Verwijderen"
                    >
                      <svg
                        className="h-5 w-5"
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
                ))}
              </div>
            </div>
          )}

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

          <div className="flex justify-end gap-3 pt-2">
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
              disabled={submitting || selectedTeachers.length === 0}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Toewijzen..." : `${selectedTeachers.length} docent${selectedTeachers.length !== 1 ? 'en' : ''} toewijzen`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
