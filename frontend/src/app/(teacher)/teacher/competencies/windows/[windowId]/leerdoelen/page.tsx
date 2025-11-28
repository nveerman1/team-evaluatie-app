"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { competencyService } from "@/services";
import type { TeacherGoalsList } from "@/dtos";
import { Loading, ErrorMessage, Tile } from "@/components";
import Link from "next/link";

export default function LeerdoelenTabPage() {
  const params = useParams();
  const windowId = Number(params.windowId);

  const [data, setData] = useState<TeacherGoalsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter and search state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "achieved" | "not_achieved">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<"name_asc" | "name_desc" | "date_new" | "date_old">("name_asc");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await competencyService.getWindowGoals(windowId);
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

  // Get unique competency names from data for filtering
  const categories = useMemo(() => {
    if (!data) return [];
    const cats = new Set<string>();
    data.items.forEach((item) => {
      if (item.competency_name) {
        cats.add(item.competency_name);
      }
    });
    return Array.from(cats).sort();
  }, [data]);

  // Filtered and sorted items
  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    
    const arr = data.items.filter((r) => {
      // Status filter
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      
      // Category filter
      if (categoryFilter !== "all" && r.competency_name !== categoryFilter) return false;
      
      // Search query
      if (q) {
        const hay = `${r.user_name ?? ""} ${r.goal_text ?? ""} ${r.competency_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Sort - create a new sorted array
    const sorted = [...arr].sort((a, b) => {
      const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
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
  }, [data, query, statusFilter, categoryFilter, sort]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      in_progress: "ring-blue-200 bg-blue-50 text-blue-700",
      achieved: "ring-green-200 bg-green-50 text-green-700",
      not_achieved: "ring-red-200 bg-red-50 text-red-700",
    };
    const labels: Record<string, string> = {
      in_progress: "In uitvoering",
      achieved: "Behaald",
      not_achieved: "Niet behaald",
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ring-1 ${styles[status] || "ring-slate-200 bg-slate-50 text-slate-600"}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Data not found" />;

  const achievedCount = data.items.filter((i) => i.status === "achieved").length;
  const inProgressCount = data.items.filter((i) => i.status === "in_progress").length;

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Totaal leerdoelen" value={data.items.length} />
        <Tile label="Behaald" value={achievedCount} />
        <Tile label="In uitvoering" value={inProgressCount} />
        <Tile label="Niet behaald" value={data.items.filter((i) => i.status === "not_achieved").length} />
      </section>

      {/* Filters */}
      <div className="sticky top-0 bg-white/80 backdrop-blur border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center gap-3 shadow-sm">
        <input
          className="px-3 py-2 border border-slate-200 rounded-xl w-80 focus:outline-none focus:ring-2 focus:ring-blue-600"
          placeholder="Zoek op student/leerdoel…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">Alle statussen</option>
          <option value="in_progress">In uitvoering</option>
          <option value="achieved">Behaald</option>
          <option value="not_achieved">Niet behaald</option>
        </select>
        <select
          className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">Alle competenties</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
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

      {/* Count */}
      <div className="text-sm text-slate-600">
        {filtered.length}/{data.items.length} leerdoelen
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            Geen leerdoelen gevonden.
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
                    Competentie
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">
                    Leerdoel
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                    Laatste update
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="bg-white hover:bg-slate-50">
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
                      {item.competency_name || "–"}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-800">
                      <div className="max-w-md truncate" title={item.goal_text}>
                        {item.goal_text}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">
                      {item.updated_at
                        ? new Date(item.updated_at).toLocaleDateString("nl-NL")
                        : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
