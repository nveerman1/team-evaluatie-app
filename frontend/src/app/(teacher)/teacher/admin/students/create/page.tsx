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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin • Nieuwe leerling</h1>
        <Link href="/teacher/admin/students" className="text-sm underline">
          ← Terug naar leerlingen
        </Link>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm">
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
  );
}
