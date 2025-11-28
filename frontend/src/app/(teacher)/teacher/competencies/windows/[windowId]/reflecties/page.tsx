"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { competencyService } from "@/services";
import type { TeacherReflectionsList } from "@/dtos";
import { Loading, ErrorMessage, Tile } from "@/components";
import Link from "next/link";

export default function ReflectiesTabPage() {
  const params = useParams();
  const windowId = Number(params.windowId);

  const [data, setData] = useState<TeacherReflectionsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter and search state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "with_goal" | "without_goal">("all");
  const [sort, setSort] = useState<"name_asc" | "name_desc" | "date_new" | "date_old">("name_asc");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await competencyService.getWindowReflections(windowId);
      setData(result);
      // Initialize expanded state
      const map: Record<number, boolean> = {};
      result.items.forEach((i) => (map[i.id] = false));
      setExpanded(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [windowId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered and sorted items
  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    
    const arr = data.items.filter((r) => {
      // Status filter
      if (statusFilter === "with_goal" && !r.goal_id) return false;
      if (statusFilter === "without_goal" && r.goal_id) return false;
      
      // Search query
      if (q) {
        const hay = `${r.user_name ?? ""} ${r.text ?? ""} ${r.goal_text ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Sort - create a new sorted array
    const sorted = [...arr].sort((a, b) => {
      const aDate = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const bDate = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      switch (sort) {
        case "name_asc":
          return (a.user_name || "").localeCompare(b.user_name || "");
        case "name_desc":
          return (b.user_name || "").localeCompare(a.user_name || "");
        case "date_new":
          return bDate - aDate;
        case "date_old":
          return aDate - bDate;
      }
    });
    return sorted;
  }, [data, query, statusFilter, sort]);

  const toggleAll = (open: boolean) => {
    const map: Record<number, boolean> = {};
    filtered.forEach((i) => (map[i.id] = open));
    setExpanded(map);
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Data not found" />;

  const withGoalCount = data.items.filter((i) => i.goal_id).length;
  const achievedCount = data.items.filter((i) => i.goal_achieved === true).length;

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Totaal reflecties" value={data.items.length} />
        <Tile label="Met gekoppeld leerdoel" value={withGoalCount} />
        <Tile label="Doel behaald" value={achievedCount} />
        <Tile label="Zonder leerdoel" value={data.items.length - withGoalCount} />
      </section>

      {/* Filters */}
      <div className="sticky top-0 bg-white/80 backdrop-blur border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center gap-3 shadow-sm">
        <input
          className="px-3 py-2 border border-slate-200 rounded-xl w-80 focus:outline-none focus:ring-2 focus:ring-blue-600"
          placeholder="Zoek op student/tekst…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">Alle reflecties</option>
          <option value="with_goal">Met leerdoel</option>
          <option value="without_goal">Zonder leerdoel</option>
        </select>
        <select
          className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
        >
          <option value="name_asc">Naam A→Z</option>
          <option value="name_desc">Naam Z→A</option>
          <option value="date_new">Datum nieuw → oud</option>
          <option value="date_old">Datum oud → nieuw</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button
            className="px-3 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-sm shadow-sm"
            onClick={() => toggleAll(true)}
          >
            Alles uitklappen
          </button>
          <button
            className="px-3 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-sm shadow-sm"
            onClick={() => toggleAll(false)}
          >
            Alles inklappen
          </button>
        </div>
      </div>

      {/* Count */}
      <div className="text-sm text-slate-600">
        {filtered.length}/{data.items.length} reflecties
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-slate-500">Geen reflecties gevonden.</div>
      ) : (
        <ul className="space-y-4">
          {filtered.map((item) => {
            const open = !!expanded[item.id];
            const dateLabel = item.submitted_at
              ? new Date(item.submitted_at).toLocaleString("nl-NL")
              : "—";
            return (
              <li
                key={item.id}
                className="border border-slate-200 rounded-2xl bg-white shadow-sm"
              >
                <button
                  className="w-full px-4 py-3 border-b border-slate-200 flex items-center justify-between text-left hover:bg-slate-50"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [item.id]: !open,
                    }))
                  }
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link
                      href={`/teacher/competencies/windows/${windowId}/student/${item.user_id}`}
                      className="font-semibold text-slate-900 hover:text-blue-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.user_name}
                    </Link>
                    {item.class_name && (
                      <span className="text-xs px-2 py-0.5 rounded-full ring-1 ring-slate-200 bg-slate-50 text-slate-600">
                        {item.class_name}
                      </span>
                    )}
                    {item.goal_id ? (
                      <span className="text-xs px-2 py-0.5 rounded-full ring-1 ring-green-200 bg-green-50 text-green-700">
                        met leerdoel
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full ring-1 ring-slate-200 bg-slate-50 text-slate-600">
                        zonder leerdoel
                      </span>
                    )}
                    {item.goal_achieved != null && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ring-1 ${
                        item.goal_achieved
                          ? "ring-green-200 bg-green-50 text-green-700"
                          : "ring-red-200 bg-red-50 text-red-700"
                      }`}>
                        {item.goal_achieved ? "doel behaald" : "doel niet behaald"}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-slate-500">
                    {dateLabel} {open ? "▾" : "▸"}
                  </span>
                </button>

                {open && (
                  <div className="p-4 space-y-3">
                    <div>
                      <span className="text-sm font-medium text-slate-700">Reflectie:</span>
                      <p className="whitespace-pre-wrap text-slate-800 mt-1">
                        {item.text || <em className="text-slate-500">Geen tekst</em>}
                      </p>
                    </div>
                    {item.goal_text && (
                      <div>
                        <span className="text-sm font-medium text-slate-700">Gekoppeld leerdoel:</span>
                        <p className="whitespace-pre-wrap text-slate-600 mt-1">
                          {item.goal_text}
                        </p>
                      </div>
                    )}
                    {item.evidence && (
                      <div>
                        <span className="text-sm font-medium text-slate-700">Bewijs / voorbeelden:</span>
                        <p className="whitespace-pre-wrap text-slate-600 mt-1">
                          {item.evidence}
                        </p>
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        className="px-2 py-1 border border-slate-200 rounded-xl text-sm bg-white hover:bg-slate-50 shadow-sm"
                        onClick={() => navigator.clipboard.writeText(item.text || "")}
                      >
                        Kopieer tekst
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
