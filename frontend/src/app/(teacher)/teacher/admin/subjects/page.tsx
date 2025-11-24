"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SubjectsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to new Schoolbeheer page with secties tab
    router.replace("/teacher/admin/schoolbeheer?tab=secties");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Doorverwijzen naar Schoolbeheer...</p>
      </div>
    </div>
  );
}
