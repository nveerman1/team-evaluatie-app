"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCreateAdminStudent } from "@/hooks/useAdminStudents";
import AdminStudentForm from "@/components/admin/students/AdminStudentForm";

export default function AdminStudentCreatePage() {
  const router = useRouter();
  const { create, loading, error } = useCreateAdminStudent(() => {
    router.push("/teacher/admin/students");
  });

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Link
                href="/teacher/admin/students"
                className="hover:text-blue-600 transition-colors"
              >
                Leerlingen
              </Link>
              <span>/</span>
              <span className="text-gray-900">Nieuwe leerling</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Nieuwe leerling aanmaken
            </h1>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <AdminStudentForm
          submitLabel={loading ? "Aanmaken…" : "Aanmaken"}
          onSubmit={async (payload) => {
            await create(payload);
          }}
        />
      </div>
    </>
  );
}
