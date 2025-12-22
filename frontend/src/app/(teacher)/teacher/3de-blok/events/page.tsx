"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EventsRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/teacher/3de-blok");
  }, [router]);
  
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Doorverwijzen...</p>
      </div>
    </div>
  );
}
