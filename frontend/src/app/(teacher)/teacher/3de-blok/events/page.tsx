"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock, 
  Filter, 
  Trash2, 
  Edit, 
  Download,
  CheckSquare,
  Square,
  MapPin,
  FileText
} from "lucide-react";
import { attendanceService, type AttendanceEvent } from "@/services/attendance.service";

interface Filters {
  class_name: string;
  start_date: string;
  end_date: string;
  is_external: string;
  status_open: string;
  approval_status: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}u ${minutes}m`;
  }
  return `${minutes}m`;
}

export default function AttendanceEventsPage() {
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<Filters>({
    class_name: "",
    start_date: "",
    end_date: "",
    is_external: "",
    status_open: "",
    approval_status: "",
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 50;

  useEffect(() => {
    fetchEvents();
  }, [page, filters]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = {
        page,
        per_page: perPage,
      };
      
      if (filters.class_name) params.class_name = filters.class_name;
      if (filters.start_date) params.start_date = new Date(filters.start_date).toISOString();
      if (filters.end_date) params.end_date = new Date(filters.end_date).toISOString();
      if (filters.is_external) params.is_external = filters.is_external === "true";
      if (filters.status_open) params.status_open = filters.status_open === "true";
      if (filters.approval_status) params.approval_status = filters.approval_status;

      const response = await attendanceService.listEvents(params);
      setEvents(response.events);
      setTotal(response.total);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("Kon gebeurtenissen niet ophalen");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === events.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(events.map((e) => e.id)));
    }
  };

  const handleSelectOne = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    if (!confirm(`Weet je zeker dat je ${selectedIds.size} gebeurtenissen wilt verwijderen?`)) {
      return;
    }

    try {
      await attendanceService.bulkDeleteEvents(Array.from(selectedIds));
      setSelectedIds(new Set());
      fetchEvents();
    } catch (err) {
      console.error("Error deleting events:", err);
      alert("Fout bij verwijderen");
    }
  };

  const handleDeleteOne = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze gebeurtenis wilt verwijderen?")) {
      return;
    }

    try {
      await attendanceService.deleteEvent(id);
      fetchEvents();
    } catch (err) {
      console.error("Error deleting event:", err);
      alert("Fout bij verwijderen");
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.class_name) params.append("class_name", filters.class_name);
      if (filters.start_date) params.append("start_date", new Date(filters.start_date).toISOString());
      if (filters.end_date) params.append("end_date", new Date(filters.end_date).toISOString());
      
      const response = await fetch(`/api/v1/attendance/export?${params.toString()}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Export failed");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aanwezigheid_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error exporting:", err);
      alert("Fout bij exporteren");
    }
  };

  const totalPages = Math.ceil(total / perPage);

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Gebeurtenissen laden...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Aanwezigheid - Alle gebeurtenissen</h1>
          <p className="text-gray-600 mt-1 text-sm">
            {total} {total === 1 ? "gebeurtenis" : "gebeurtenissen"} gevonden
          </p>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Actions Bar */}
      <div className="flex gap-2 justify-end">
        {selectedIds.size > 0 && (
          <Button onClick={handleBulkDelete} variant="outline" className="text-red-600">
            <Trash2 className="h-4 w-4 mr-2" />
            Verwijder geselecteerde ({selectedIds.size})
          </Button>
        )}
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exporteren
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-gray-200/80 rounded-xl p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Input
            type="text"
            placeholder="Klas..."
            value={filters.class_name}
            onChange={(e) => handleFilterChange("class_name", e.target.value)}
          />
          <Input
            type="date"
            placeholder="Van datum"
            value={filters.start_date}
            onChange={(e) => handleFilterChange("start_date", e.target.value)}
          />
          <Input
            type="date"
            placeholder="Tot datum"
            value={filters.end_date}
            onChange={(e) => handleFilterChange("end_date", e.target.value)}
          />
          <select
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={filters.is_external}
            onChange={(e) => handleFilterChange("is_external", e.target.value)}
          >
            <option value="">Alle types</option>
            <option value="false">School</option>
            <option value="true">Extern werk</option>
          </select>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={filters.status_open}
            onChange={(e) => handleFilterChange("status_open", e.target.value)}
          >
            <option value="">Alle statussen</option>
            <option value="true">Open sessies</option>
            <option value="false">Gesloten sessies</option>
          </select>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={filters.approval_status}
            onChange={(e) => handleFilterChange("approval_status", e.target.value)}
          >
            <option value="">Goedkeuringsstatus</option>
            <option value="pending">In afwachting</option>
            <option value="approved">Goedgekeurd</option>
            <option value="rejected">Afgewezen</option>
          </select>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left p-3">
                  <button onClick={handleSelectAll}>
                    {selectedIds.size === events.length && events.length > 0 ? (
                      <CheckSquare className="h-5 w-5" />
                    ) : (
                      <Square className="h-5 w-5" />
                    )}
                  </button>
                </th>
                <th className="text-left p-3">Student</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Check-in</th>
                <th className="text-left p-3">Check-out</th>
                <th className="text-left p-3">Duur</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Acties</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    Geen gebeurtenissen gevonden
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-3">
                      <button onClick={() => handleSelectOne(event.id)}>
                        {selectedIds.has(event.id) ? (
                          <CheckSquare className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">User #{event.user_id}</div>
                    </td>
                    <td className="p-3">
                      {event.is_external ? (
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <MapPin className="h-3 w-3" />
                          Extern
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Clock className="h-3 w-3" />
                          School
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="text-sm">
                        {formatDate(event.check_in)}
                        <br />
                        <span className="text-gray-600">{formatTime(event.check_in)}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      {event.check_out ? (
                        <div className="text-sm">
                          {formatDate(event.check_out)}
                          <br />
                          <span className="text-gray-600">{formatTime(event.check_out)}</span>
                        </div>
                      ) : (
                        <Badge variant="secondary">Open</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="font-medium">
                        {formatDuration(event.duration_seconds)}
                      </span>
                    </td>
                    <td className="p-3">
                      {event.is_external && event.approval_status && (
                        <Badge
                          variant={
                            event.approval_status === "approved"
                              ? "default"
                              : event.approval_status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {event.approval_status === "approved"
                            ? "Goedgekeurd"
                            : event.approval_status === "rejected"
                            ? "Afgewezen"
                            : "In afwachting"}
                        </Badge>
                      )}
                      {event.is_external && event.location && (
                        <div className="text-xs text-gray-600 mt-1">
                          📍 {event.location}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" title="Bewerken">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOne(event.id)}
                          title="Verwijderen"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Pagina {page} van {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Vorige
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Volgende
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
