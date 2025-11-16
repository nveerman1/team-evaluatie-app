"use client";

import React, { useState, useMemo } from "react";
import { EvaluationResult } from "@/dtos";

type FiltersProps = {
  items: EvaluationResult[];
  onFilter: (f: { q: string; course: string; status: string }) => void;
};

export function Filters({ items, onFilter }: FiltersProps) {
  const [q, setQ] = useState("");
  const [course, setCourse] = useState("");
  const [status, setStatus] = useState("");

  const courses = useMemo(() => {
    const set = new Set(items.map((i) => i.course));
    return Array.from(set);
  }, [items]);

  const apply = () => onFilter({ q, course, status });
  const reset = () => {
    setQ("");
    setCourse("");
    setStatus("");
    onFilter({ q: "", course: "", status: "" });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onBlur={apply}
        type="text"
        placeholder="Zoek op titel, vak..."
        className="px-3 py-2 rounded-lg border w-64"
      />
      <select
        value={course}
        onChange={(e) => {
          const newCourse = e.target.value;
          setCourse(newCourse);
          onFilter({ q, course: newCourse, status });
        }}
        className="px-3 py-2 rounded-lg border"
      >
        <option value="">Alle vakken</option>
        {courses.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        value={status}
        onChange={(e) => {
          const newStatus = e.target.value;
          setStatus(newStatus);
          onFilter({ q, course, status: newStatus });
        }}
        className="px-3 py-2 rounded-lg border"
      >
        <option value="">Alle statussen</option>
        <option value="open">Open</option>
        <option value="closed">Afgerond</option>
        <option value="processing">In verwerking</option>
      </select>
      {(q || course || status) && (
        <button onClick={reset} className="px-3 py-2 rounded-lg border hover:bg-gray-50">
          Reset
        </button>
      )}
    </div>
  );
}
