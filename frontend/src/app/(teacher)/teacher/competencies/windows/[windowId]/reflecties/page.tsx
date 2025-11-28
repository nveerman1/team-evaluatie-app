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
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // Filter and search state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "with_goal" | "without_goal">("all");
  const [sort, setSort] = useState<"name_asc" | "name_desc" | "date_new" | "date_old">("name_asc");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await competencyService.getWindowReflections(windowId);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [windowId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleRow = (id: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

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

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
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
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            Geen reflecties gevonden.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">
                    Leerling
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">
                    Datum
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">
                    Reflectie
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">
                    Gekoppeld leerdoel
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                    Doel behaald
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 tracking-wide">
                    Actie
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr className="bg-white hover:bg-slate-50">
                      <td className="px-5 py-3 text-sm text-slate-800 font-medium">
                        <Link
                          href={`/teacher/competencies/windows/${windowId}/student/${item.user_id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {item.user_name}
                        </Link>
                        {item.class_name && (
                          <span className="ml-2 text-xs text-slate-500">
                            ({item.class_name})
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600">
                        {item.submitted_at
                          ? new Date(item.submitted_at).toLocaleDateString("nl-NL")
                          : "–"}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-800">
                        <div className="max-w-md" title={item.text}>
                          {truncateText(item.text)}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600">
                        {item.goal_text ? truncateText(item.goal_text, 50) : "–"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.goal_achieved != null ? (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ring-1 ${
                              item.goal_achieved
                                ? "ring-green-200 bg-green-50 text-green-700"
                                : "ring-red-200 bg-red-50 text-red-700"
                            }`}
                          >
                            {item.goal_achieved ? "Ja" : "Nee"}
                          </span>
                        ) : (
                          <span className="text-slate-400">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleRow(item.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {expandedRows.has(item.id) ? "Inklappen" : "Bekijken"}
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(item.id) && (
                      <tr key={`${item.id}-details`} className="bg-slate-50">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="space-y-4">
                            <div>
                              <span className="text-sm font-medium text-slate-700">
                                Volledige reflectie:
                              </span>
                              <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">
                                {item.text}
                              </p>
                            </div>
                            {item.goal_text && (
                              <div>
                                <span className="text-sm font-medium text-slate-700">
                                  Gekoppeld leerdoel:
                                </span>
                                <p className="text-sm text-slate-600 mt-1">
                                  {item.goal_text}
                                </p>
                              </div>
                            )}
                            {item.evidence && (
                              <div>
                                <span className="text-sm font-medium text-slate-700">
                                  Bewijs / voorbeelden:
                                </span>
                                <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">
                                  {item.evidence}
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
