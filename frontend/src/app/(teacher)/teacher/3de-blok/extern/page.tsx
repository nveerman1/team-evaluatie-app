"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  X, 
  Filter, 
  MapPin,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { attendanceService, type AttendanceEvent } from "@/services/attendance.service";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}u ${minutes}m`;
}

export default function ExternalWorkPage() {
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState("pending");
  const [classFilter, setClassFilter] = useState("");

  useEffect(() => {
    fetchExternalWork();
  }, [statusFilter, classFilter]);

  const fetchExternalWork = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = {
        is_external: true,
        per_page: 100,
      };
      
      if (statusFilter) params.approval_status = statusFilter;
      if (classFilter) params.class_name = classFilter;

      const response = await attendanceService.listEvents(params);
      setEvents(response.events);
    } catch (err) {
      console.error("Error fetching external work:", err);
      setError("Kon extern werk niet ophalen");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await attendanceService.approveExternalWork(id);
      fetchExternalWork();
    } catch (err) {
      console.error("Error approving:", err);
      alert("Fout bij goedkeuren");
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt("Reden voor afwijzing (optioneel):");
    if (reason === null) return; // User cancelled
    
    try {
      await attendanceService.rejectExternalWork(id, reason || undefined);
      fetchExternalWork();
    } catch (err) {
      console.error("Error rejecting:", err);
      alert("Fout bij afwijzen");
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    
    if (!confirm(`Weet je zeker dat je ${selectedIds.size} extern werk registraties wilt goedkeuren?`)) {
      return;
    }

    try {
      await attendanceService.bulkApproveExternalWork(Array.from(selectedIds));
      setSelectedIds(new Set());
      fetchExternalWork();
    } catch (err) {
      console.error("Error bulk approving:", err);
      alert("Fout bij goedkeuren");
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

  const pendingCount = events.filter(e => e.approval_status === "pending").length;

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Extern werk laden...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Extern Werk - Beheer</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Goedkeuren of afwijzen van externe werk registraties
          </p>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {selectedIds.size > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleBulkApprove} className="bg-green-600 hover:bg-green-700">
            <Check className="h-4 w-4 mr-2" />
            Goedkeuren geselecteerde ({selectedIds.size})
          </Button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-gray-200/80 rounded-xl p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-600">In afwachting</p>
              <p className="text-2xl font-semibold">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Goedgekeurd</p>
              <p className="text-2xl font-semibold">
                {events.filter(e => e.approval_status === "approved").length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">Afgewezen</p>
              <p className="text-2xl font-semibold">
                {events.filter(e => e.approval_status === "rejected").length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        <div className="flex gap-4">
          <select
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Alle statussen</option>
            <option value="pending">In afwachting</option>
            <option value="approved">Goedgekeurd</option>
            <option value="rejected">Afgewezen</option>
          </select>
          <Input
            type="text"
            placeholder="Filter op klas..."
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="max-w-xs"
          />
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-12 text-center">
            <MapPin className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600">Geen extern werk gevonden</h3>
            <p className="text-gray-500 mt-2">Er zijn geen registraties met de huidige filters</p>
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    {event.approval_status === "pending" && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(event.id)}
                        onChange={() => handleSelectOne(event.id)}
                        className="h-5 w-5"
                      />
                    )}
                    <div>
                      <h3 className="font-semibold text-lg">User #{event.user_id}</h3>
                      <div className="flex items-center gap-2 mt-1">
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
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <p className="text-sm text-gray-600">📍 Locatie</p>
                      <p className="font-medium">{event.location || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">📅 Periode</p>
                      <p className="font-medium">
                        {formatDate(event.check_in)} - {formatDate(event.check_out || "")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">⏱️ Duur</p>
                      <p className="font-medium">{formatDuration(event.duration_seconds)}</p>
                    </div>
                  </div>

                  {event.description && (
                    <div className="mt-4 p-3 bg-gray-50 rounded">
                      <p className="text-sm text-gray-600 mb-1">Beschrijving:</p>
                      <p className="text-sm">{event.description}</p>
                    </div>
                  )}

                  {event.approved_at && (
                    <div className="mt-3 text-xs text-gray-500">
                      {event.approval_status === "approved" ? "Goedgekeurd" : "Afgewezen"} op{" "}
                      {formatDate(event.approved_at)}
                    </div>
                  )}
                </div>

                {event.approval_status === "pending" && (
                  <div className="flex gap-2 ml-4">
                    <Button
                      onClick={() => handleApprove(event.id)}
                      className="bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Goedkeuren
                    </Button>
                    <Button
                      onClick={() => handleReject(event.id)}
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      size="sm"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Afwijzen
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      </div>
    </>
  );
}
