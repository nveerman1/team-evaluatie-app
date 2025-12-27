"use client";

import { useState } from "react";
import { useNumericEvalId } from "@/lib/id";
import { PeerfeedbackTable } from "@/components/teacher/PeerfeedbackTable";
import { Search } from "lucide-react";

export default function FeedbackPageInner() {
  const evalIdNum = useNumericEvalId();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "self" | "peer">("all");

  if (evalIdNum == null) {
    return (
      <p className="text-sm text-slate-500">
        Geen geldige evaluatie geselecteerd.
      </p>
    );
  }

  return (
    <>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Zoek op student/criterium/tekst…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
        >
          <option value="all">Alle (self + peer)</option>
          <option value="self">Alleen self</option>
          <option value="peer">Alleen peer</option>
        </select>
      </div>

      {/* Aggregated Feedback Table */}
      <PeerfeedbackTable 
        filters={{ evaluationId: evalIdNum }}
        searchQuery={query}
        typeFilter={typeFilter}
      />
    </>
  );
}
