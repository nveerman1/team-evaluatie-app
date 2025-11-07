"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { overviewService } from "@/services";
import { OverviewItem, OverviewFilters } from "@/dtos/overview.dto";
import { Loading } from "@/components";
import { formatDate } from "@/utils";

export default function AllItemsTab() {
  const [items, setItems] = useState<OverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalProjects, setTotalProjects] = useState(0);
  const [totalPeers, setTotalPeers] = useState(0);
  const [totalCompetencies, setTotalCompetencies] = useState(0);
  
  // Filter state
  const [filters, setFilters] = useState<OverviewFilters>({
    page: 1,
    limit: 50,
    sort_by: "date",
    sort_order: "desc",
  });
  
  // Separate state for filter inputs to avoid immediate re-fetching
  const [filterInputs, setFilterInputs] = useState({
    search: "",
    type: "",
    status: "",
    date_from: "",
    date_to: "",
  });

  // Load data
  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await overviewService.getAllItems(filters);
      setItems(response.items);
      setTotal(response.total);
      setTotalProjects(response.total_projects);
      setTotalPeers(response.total_peers);
      setTotalCompetencies(response.total_competencies);
    } catch (error) {
      console.error("Error loading overview items:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setFilters({
      ...filters,
      search: filterInputs.search || undefined,
      type: filterInputs.type ? (filterInputs.type as "project" | "peer" | "competency") : undefined,
      status: filterInputs.status || undefined,
      date_from: filterInputs.date_from || undefined,
      date_to: filterInputs.date_to || undefined,
      page: 1, // Reset to first page
    });
  };

  const handleResetFilters = () => {
    setFilterInputs({
      search: "",
      type: "",
      status: "",
      date_from: "",
      date_to: "",
    });
    setFilters({
      page: 1,
      limit: 50,
      sort_by: "date",
      sort_order: "desc",
    });
  };

  const handleSort = (sortBy: "date" | "student" | "score") => {
    const newOrder = 
      filters.sort_by === sortBy && filters.sort_order === "desc" 
        ? "asc" 
        : "desc";
    
    setFilters({
      ...filters,
      sort_by: sortBy,
      sort_order: newOrder,
    });
  };

  const handleExportCSV = async () => {
    try {
      const blob = await overviewService.exportCSV(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `overzicht-alle-items-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting CSV:", error);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "project":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium">
            📊 Project
          </span>
        );
      case "peer":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs font-medium">
            👥 Peer
          </span>
        );
      case "competency":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-medium">
            🎯 Competentie
          </span>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      open: { bg: "bg-green-50", text: "text-green-700", label: "Open" },
      closed: { bg: "bg-gray-50", text: "text-gray-700", label: "Gesloten" },
      draft: { bg: "bg-yellow-50", text: "text-yellow-700", label: "Concept" },
      published: { bg: "bg-blue-50", text: "text-blue-700", label: "Gepubliceerd" },
    };
    
    const s = statusMap[status] || { bg: "bg-gray-50", text: "text-gray-700", label: status };
    
    return (
      <span className={`px-2 py-1 rounded-lg ${s.bg} ${s.text} text-xs font-medium`}>
        {s.label}
      </span>
    );
  };

  const pageCount = Math.ceil(total / filters.limit);

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-1">Totaal items</div>
          <div className="text-2xl font-bold">{total}</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="text-sm text-blue-600 mb-1">📊 Projecten</div>
          <div className="text-2xl font-bold text-blue-700">{totalProjects}</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <div className="text-sm text-purple-600 mb-1">👥 Peerevaluaties</div>
          <div className="text-2xl font-bold text-purple-700">{totalPeers}</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <div className="text-sm text-green-600 mb-1">🎯 Competenties</div>
          <div className="text-2xl font-bold text-green-700">{totalCompetencies}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-sm text-gray-700">Filters</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Zoeken</label>
            <input
              type="text"
              placeholder="Naam of titel..."
              className="w-full px-3 py-2 text-sm border rounded-lg"
              value={filterInputs.search}
              onChange={(e) => setFilterInputs({ ...filterInputs, search: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Type</label>
            <select
              className="w-full px-3 py-2 text-sm border rounded-lg"
              value={filterInputs.type}
              onChange={(e) => setFilterInputs({ ...filterInputs, type: e.target.value })}
            >
              <option value="">Alle</option>
              <option value="project">Project</option>
              <option value="peer">Peer</option>
              <option value="competency">Competentie</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Status</label>
            <select
              className="w-full px-3 py-2 text-sm border rounded-lg"
              value={filterInputs.status}
              onChange={(e) => setFilterInputs({ ...filterInputs, status: e.target.value })}
            >
              <option value="">Alle</option>
              <option value="open">Open</option>
              <option value="closed">Gesloten</option>
              <option value="draft">Concept</option>
              <option value="published">Gepubliceerd</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Van datum</label>
            <input
              type="date"
              className="w-full px-3 py-2 text-sm border rounded-lg"
              value={filterInputs.date_from}
              onChange={(e) => setFilterInputs({ ...filterInputs, date_from: e.target.value })}
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Tot datum</label>
            <input
              type="date"
              className="w-full px-3 py-2 text-sm border rounded-lg"
              value={filterInputs.date_to}
              onChange={(e) => setFilterInputs({ ...filterInputs, date_to: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleApplyFilters}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:opacity-90"
          >
            Toepassen
          </button>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-100"
          >
            Reset
          </button>
          <button
            onClick={handleExportCSV}
            className="ml-auto px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-100"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium mb-2">Geen items gevonden</p>
          <p className="text-sm mb-4">Pas de filters aan om resultaten te zien</p>
          <button
            onClick={handleResetFilters}
            className="text-blue-600 hover:underline text-sm"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left text-xs text-gray-600 uppercase tracking-wider">
                <th className="px-4 py-3">
                  <button
                    onClick={() => handleSort("student")}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    Leerling
                    {filters.sort_by === "student" && (
                      <span>{filters.sort_order === "asc" ? "↑" : "↓"}</span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Titel</th>
                <th className="px-4 py-3">Vak</th>
                <th className="px-4 py-3">Docent</th>
                <th className="px-4 py-3">
                  <button
                    onClick={() => handleSort("date")}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    Datum
                    {filters.sort_by === "date" && (
                      <span>{filters.sort_order === "asc" ? "↑" : "↓"}</span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    onClick={() => handleSort("score")}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    Score
                    {filters.sort_by === "score" && (
                      <span>{filters.sort_order === "asc" ? "↑" : "↓"}</span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item, idx) => (
                <tr
                  key={`${item.type}-${item.id}-${item.student_id}-${idx}`}
                  className="hover:bg-gray-50 text-sm"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.student_name}</div>
                    {item.student_class && (
                      <div className="text-xs text-gray-500">{item.student_class}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {getTypeBadge(item.type)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.title}</div>
                    {item.team_name && (
                      <div className="text-xs text-gray-500">{item.team_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.course_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.teacher_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.date ? formatDate(item.date) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{item.score_label || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={item.detail_url}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Bekijk →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {items.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-600">
            Pagina {filters.page} van {pageCount} • {total} totaal
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              disabled={filters.page === 1}
              className="px-3 py-2 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Vorige
            </button>
            <button
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              disabled={filters.page >= pageCount}
              className="px-3 py-2 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Volgende
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
