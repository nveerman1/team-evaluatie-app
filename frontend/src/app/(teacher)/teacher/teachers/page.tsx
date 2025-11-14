"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

// Type definitions
type Role = "docent" | "admin";
type Status = "actief" | "inactief";
type Subject = {
  id: number;
  name: string;
  code: string;
  level: "onderbouw" | "bovenbouw";
  year: number;
};
type Teacher = {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: Status;
  subjects: Subject[];
  createdAt: string;
  lastLogin?: string;
};

// Mock data
const MOCK_TEACHERS: Teacher[] = [
  {
    id: 1,
    name: "Anna de Vries",
    email: "a.devries@school.nl",
    role: "admin",
    status: "actief",
    subjects: [
      { id: 1, name: "Wiskunde A", code: "wis_a", level: "bovenbouw", year: 2025 },
      { id: 2, name: "Wiskunde B", code: "wis_b", level: "bovenbouw", year: 2025 },
    ],
    createdAt: "2024-01-15",
    lastLogin: "2025-11-14",
  },
  {
    id: 2,
    name: "Peter Jansen",
    email: "p.jansen@school.nl",
    role: "docent",
    status: "actief",
    subjects: [
      { id: 3, name: "Nederlands", code: "ne", level: "onderbouw", year: 2025 },
      { id: 4, name: "Engels", code: "en", level: "onderbouw", year: 2025 },
      { id: 5, name: "Geschiedenis", code: "gs", level: "bovenbouw", year: 2025 },
    ],
    createdAt: "2024-03-22",
    lastLogin: "2025-11-13",
  },
  {
    id: 3,
    name: "Maria Bakker",
    email: "m.bakker@school.nl",
    role: "docent",
    status: "actief",
    subjects: [
      { id: 6, name: "Biologie", code: "bi", level: "bovenbouw", year: 2025 },
    ],
    createdAt: "2024-05-10",
    lastLogin: "2025-11-12",
  },
  {
    id: 4,
    name: "Jan Vermeer",
    email: "j.vermeer@school.nl",
    role: "docent",
    status: "inactief",
    subjects: [],
    createdAt: "2023-09-01",
    lastLogin: "2025-10-01",
  },
  {
    id: 5,
    name: "Sophie van der Berg",
    email: "s.vandeberg@school.nl",
    role: "admin",
    status: "actief",
    subjects: [
      { id: 7, name: "Onderzoek & Ontwerpen", code: "oo_ga2", level: "onderbouw", year: 2025 },
    ],
    createdAt: "2024-02-28",
    lastLogin: "2025-11-14",
  },
];

export default function TeachersPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Redirect non-admins
  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push("/teacher");
    }
  }, [isAdmin, loading, router]);

  // Filter teachers
  const filteredTeachers = useMemo(() => {
    return MOCK_TEACHERS.filter((teacher) => {
      const matchesSearch =
        teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === "" || teacher.role === roleFilter;
      const matchesStatus =
        statusFilter === "" || teacher.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [searchTerm, roleFilter, statusFilter]);

  // Update selected teacher when filters change
  useEffect(() => {
    if (filteredTeachers.length > 0) {
      const currentIsInList = filteredTeachers.some((t) => t.id === selectedId);
      if (!currentIsInList) {
        setSelectedId(filteredTeachers[0].id);
      }
    } else {
      setSelectedId(null);
    }
  }, [filteredTeachers, selectedId]);

  // Set initial selection
  useEffect(() => {
    if (selectedId === null && filteredTeachers.length > 0) {
      setSelectedId(filteredTeachers[0].id);
    }
  }, [selectedId, filteredTeachers]);

  const selectedTeacher = filteredTeachers.find((t) => t.id === selectedId);

  // Stats
  const totalTeachers = MOCK_TEACHERS.length;
  const activeTeachers = MOCK_TEACHERS.filter((t) => t.status === "actief").length;
  const adminTeachers = MOCK_TEACHERS.filter((t) => t.role === "admin").length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Docenten beheren
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Beheer alle docenten van jouw school en hun gekoppelde vakken
            </p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            <button className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Importeer CSV
            </button>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
              + Nieuwe docent
            </button>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Left Column */}
          <div className="flex-1 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                <p className="text-sm font-medium text-gray-600">
                  Totaal docenten
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {totalTeachers}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                <p className="text-sm font-medium text-gray-600">Actief</p>
                <p className="mt-1 text-2xl font-bold text-green-600">
                  {activeTeachers}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                <p className="text-sm font-medium text-gray-600">Admins</p>
                <p className="mt-1 text-2xl font-bold text-purple-600">
                  {adminTeachers}
                </p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-gray-400">🔍</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Zoek op naam of e-mail…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Alle rollen</option>
                  <option value="docent">Docent</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Alle statussen</option>
                  <option value="actief">Actief</option>
                  <option value="inactief">Inactief</option>
                </select>
              </div>
            </div>

            {/* Teacher List */}
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm">
              <div className="border-b border-gray-200 px-4 py-3">
                <p className="text-sm font-medium text-gray-700">
                  {filteredTeachers.length} docenten gevonden
                </p>
              </div>
              <ul className="divide-y divide-gray-200">
                {filteredTeachers.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm text-gray-500">
                    Geen docenten gevonden met de huidige filters.
                  </li>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <li
                      key={teacher.id}
                      onClick={() => setSelectedId(teacher.id)}
                      className={`cursor-pointer px-4 py-4 transition-colors ${
                        selectedId === teacher.id
                          ? "bg-blue-50"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {teacher.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {teacher.email}
                          </p>
                        </div>
                        <div className="ml-4 flex items-center gap-2">
                          {teacher.role === "admin" ? (
                            <span className="inline-flex rounded-full border border-purple-100 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                              Admin
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                              Docent
                            </span>
                          )}
                          {teacher.status === "actief" ? (
                            <span className="inline-flex rounded-full border border-green-100 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                              Actief
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                              Inactief
                            </span>
                          )}
                          <button className="ml-2 rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                            Bewerken
                          </button>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          {/* Right Column - Detail Sidebar */}
          <div className="lg:w-80">
            <div className="sticky top-28 bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Docentdetails
              </h2>

              {selectedTeacher ? (
                <div className="space-y-6">
                  {/* Teacher Info */}
                  <div>
                    <p className="text-base font-semibold text-gray-900">
                      {selectedTeacher.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedTeacher.email}
                    </p>
                    <div className="mt-2 flex gap-2">
                      {selectedTeacher.role === "admin" ? (
                        <span className="inline-flex rounded-full border border-purple-100 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          Docent
                        </span>
                      )}
                      {selectedTeacher.status === "actief" ? (
                        <span className="inline-flex rounded-full border border-green-100 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          Actief
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          Inactief
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <dl className="space-y-3 border-t border-gray-200 pt-4">
                    <div>
                      <dt className="text-xs font-medium text-gray-500">
                        Aangemaakt
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {selectedTeacher.createdAt}
                      </dd>
                    </div>
                    {selectedTeacher.lastLogin && (
                      <div>
                        <dt className="text-xs font-medium text-gray-500">
                          Laatst ingelogd
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {selectedTeacher.lastLogin}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs font-medium text-gray-500">
                        Vak-koppelingen
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {selectedTeacher.subjects.length}
                      </dd>
                    </div>
                  </dl>

                  {/* Subjects Section */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Gekoppelde vakken
                      </h3>
                      <button className="text-xs font-medium text-blue-600 hover:text-blue-700">
                        Beheer koppelingen
                      </button>
                    </div>

                    {selectedTeacher.subjects.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        Nog geen vakken gekoppeld. Gebruik &apos;Beheer koppelingen&apos;
                        om vakken toe te wijzen.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedTeacher.subjects.map((subject) => (
                          <div
                            key={subject.id}
                            className="rounded-md border border-gray-200 bg-gray-50 p-3"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {subject.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {subject.code} · {subject.year} ·{" "}
                                  {subject.level}
                                </p>
                              </div>
                              <button className="ml-2 text-xs font-medium text-red-600 hover:text-red-700">
                                Verwijder
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 border-t border-gray-200 pt-4">
                    <button className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      Bewerk docent
                    </button>
                    <button className="w-full rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500">
                      {selectedTeacher.status === "actief"
                        ? "Deactiveer"
                        : "Activeer"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Kies een docent in de lijst om details te bekijken.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
