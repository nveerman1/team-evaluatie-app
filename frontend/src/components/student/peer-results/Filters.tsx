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

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 md:flex-row md:items-center">
        <div className="flex-1">
          <label className="sr-only" htmlFor="search">
            Zoek peer-feedback
          </label>
          <input
            id="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={apply}
            placeholder="Zoek op titel, vak of sprint..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={course}
            onChange={(e) => {
              const newCourse = e.target.value;
              setCourse(newCourse);
              onFilter({ q, course: newCourse, status });
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">Alle statussen</option>
            <option value="open">Open</option>
            <option value="closed">Afgesloten</option>
          </select>
        </div>
      </div>
    </section>
  );
}
