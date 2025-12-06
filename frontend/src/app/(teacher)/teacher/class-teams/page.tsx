"use client";

import { Suspense } from "react";
import ClassTeamsPageInner from "./_inner";

export default function ClassTeamsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
    </div>}>
      <ClassTeamsPageInner />
    </Suspense>
  );
}
