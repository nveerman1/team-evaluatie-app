"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Student3deBlokPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to student dashboard with attendance tab active
    router.replace("/student?tab=attendance");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Doorverwijzen naar 3de Blok tab...</p>
      </div>
    </div>
  );
}
