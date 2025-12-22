"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Trash2,
  Edit,
  Download,
  X,
} from "lucide-react";
import { attendanceService, type AttendanceEvent } from "@/services/attendance.service";
import { toast } from "@/lib/toast";

interface SchoolCheckRow {
  id: number;
  student_name: string;
  class_name: string;
  check_in: string;
  check_out: string | null;
  duration: string;
}

function Chip({ text, onRemove }: { text: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
      {text}
      <button
        type="button"
        className="rounded-full p-1 hover:bg-slate-200"
        onClick={onRemove}
        aria-label={`Verwijder filter ${text}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("nl-NL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeOnly(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calculateDuration(start: string, end: string | null): string {
  if (!end) return "-";
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

export default function EventsTab() {
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [nameQuery, setNameQuery] = useState("");
  const [classQuery, setClassQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<SchoolCheckRow | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");

  useEffect(() => {
    fetchSchoolEvents();
  }, []);

  const fetchSchoolEvents = async () => {
    try {
      setLoading(true);
      
      const params: Record<string, boolean | number | string> = {
        is_external: false,
        per_page: 100,
      };

      const response = await attendanceService.listEvents(params);
      setEvents(response.events);
    } catch (err) {
      console.error("Error fetching school events:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Kon school check-in/out gebeurtenissen niet ophalen: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Transform events to rows with user data
  const rows: SchoolCheckRow[] = useMemo(() => {
    return events.map((event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eventWithUser = event as any;
      return {
        id: event.id,
        student_name: eventWithUser.user_name || `User #${event.user_id}`,
        class_name: eventWithUser.user_class || "-",
        check_in: event.check_in,
        check_out: event.check_out,
        duration: calculateDuration(event.check_in, event.check_out),
      };
    });
  }, [events]);

  const filtered = useMemo(() => {
    const nq = nameQuery.trim().toLowerCase();
    const cq = classQuery.trim().toLowerCase();
    return rows.filter((r) => {
      const matchName = !nq || r.student_name.toLowerCase().includes(nq);
      const matchClass = !cq || r.class_name.toLowerCase().includes(cq);
      
      let matchDate = true;
      if (startDate || endDate) {
        const checkInDate = new Date(r.check_in);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          matchDate = matchDate && checkInDate >= start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          matchDate = matchDate && checkInDate <= end;
        }
      }
      
      return matchName && matchClass && matchDate;
    });
  }, [rows, nameQuery, classQuery, startDate, endDate]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[Number(id)]).map(Number), [selected]);
  const selectedCount = selectedIds.length;
  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected[r.id]);

  function toggleSelectAllVisible() {
    setSelected((prev) => {
      const next = { ...prev };
      for (const r of filtered) next[r.id] = !allVisibleSelected;
      return next;
    });
  }

  function toggleSelectOne(id: number) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; text: string; clear: () => void }> = [];
    if (nameQuery.trim()) chips.push({ key: "name", text: `Naam: ${nameQuery}`, clear: () => setNameQuery("") });
    if (classQuery.trim()) chips.push({ key: "class", text: `Klas: ${classQuery}`, clear: () => setClassQuery("") });
    if (startDate) chips.push({ key: "startDate", text: `Van: ${startDate}`, clear: () => setStartDate("") });
    if (endDate) chips.push({ key: "endDate", text: `Tot: ${endDate}`, clear: () => setEndDate("") });
    return chips;
  }, [nameQuery, classQuery, startDate, endDate]);

  async function bulkDelete() {
    if (selectedCount === 0) return;
    
    if (!confirm(`Weet je zeker dat je ${selectedCount} registratie(s) wilt verwijderen?`)) {
      return;
    }

    try {
      await attendanceService.bulkDeleteEvents(selectedIds);
      setSelected({});
      await fetchSchoolEvents();
      toast.success(`${selectedCount} registraties verwijderd`);
    } catch (err) {
      console.error("Error deleting:", err);
      toast.error("Kon registraties niet verwijderen");
    }
  }

  async function deleteOne(id: number) {
    if (!confirm("Weet je zeker dat je deze registratie wilt verwijderen?")) {
      return;
    }

    try {
      await attendanceService.deleteEvent(id);
      await fetchSchoolEvents();
      toast.success("Registratie verwijderd");
    } catch (err) {
      console.error("Error deleting:", err);
      toast.error("Kon registratie niet verwijderen");
    }
  }

  function exportCsv() {
    const header = ["Naam", "Klas", "Check-in", "Check-out", "Duur"].join(",");
    const lines = filtered.map((r) =>
      [
        r.student_name,
        r.class_name,
        formatDateTime(r.check_in),
        r.check_out ? formatDateTime(r.check_out) : "-",
        r.duration,
      ].join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `in-uitcheck-log.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV geëxporteerd");
  }

  function openEditModal(row: SchoolCheckRow) {
    setSelectedRow(row);
    setEditCheckIn(row.check_in);
    setEditCheckOut(row.check_out || "");
    setEditModalOpen(true);
  }

  async function saveEdit() {
    if (!selectedRow) return;

    try {
      const updateData: Partial<AttendanceEvent> = {
        check_in: editCheckIn,
      };
      if (editCheckOut) {
        updateData.check_out = editCheckOut;
      }

      await attendanceService.updateEvent(selectedRow.id, updateData);
      setEditModalOpen(false);
      await fetchSchoolEvents();
      toast.success("Tijden bijgewerkt");
    } catch (err) {
      console.error("Error updating event:", err);
      toast.error("Kon tijden niet bijwerken");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">In-/Uitcheck log laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <input
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100 md:w-56"
                placeholder="Naam..."
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
              />
              <input
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100 md:w-28"
                placeholder="Klas..."
                value={classQuery}
                onChange={(e) => setClassQuery(e.target.value)}
              />
              <input
                type="date"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100 md:w-44"
                placeholder="Van datum"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <input
                type="date"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100 md:w-44"
                placeholder="Tot datum"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-medium text-slate-500">Actieve filters:</div>
              {activeChips.map((c) => (
                <Chip key={c.key} text={c.text} onRemove={c.clear} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bulk actions bar */}
      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              <span className="text-slate-500">Geselecteerd</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-slate-900 ring-1 ring-slate-200">{selectedCount}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              <span className="text-slate-500">Zichtbaar</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-slate-900 ring-1 ring-slate-200">{filtered.length}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={bulkDelete}
              disabled={selectedCount === 0}
              className="gap-2 bg-rose-600 hover:bg-rose-700 px-3 py-1.5 text-xs h-auto"
            >
              <Trash2 className="h-4 w-4" />
              Verwijderen
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">In-/Uitcheck gebeurtenissen</div>
            <div className="text-xs text-slate-500">Alle school check-in/out registraties binnen je filters</div>
          </div>
          <Button variant="secondary" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
        </div>

        <div>
          <table className="w-full table-fixed">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="w-10 px-5 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900"
                    aria-label="Selecteer alle zichtbare rijen"
                  />
                </th>
                <th className="px-5 py-3 w-44">Naam</th>
                <th className="px-5 py-3 w-20">Klas</th>
                <th className="px-5 py-3 w-40">Check-in</th>
                <th className="px-5 py-3 w-40">Check-out</th>
                <th className="px-5 py-3 w-20">Duur</th>
                <th className="px-5 py-3 w-24">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="group hover:bg-slate-50/60">
                  <td className="px-5 py-4 align-top">
                    <input
                      type="checkbox"
                      checked={!!selected[r.id]}
                      onChange={() => toggleSelectOne(r.id)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900"
                      aria-label={`Selecteer ${r.student_name}`}
                    />
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="font-medium text-slate-900">{r.student_name}</div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <span className="inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                      {r.class_name}
                    </span>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="text-xs text-slate-700">{formatDateTime(r.check_in)}</div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="text-xs text-slate-700">
                      {r.check_out ? formatDateTime(r.check_out) : <span className="text-slate-400">Nog open</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="text-xs font-semibold text-slate-900">{r.duration}</div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(r)}
                        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        aria-label="Bewerken"
                        title="Bewerken"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteOne(r.id)}
                        className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        aria-label="Verwijderen"
                        title="Verwijderen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center">
                    <div className="text-sm font-medium text-slate-900">Geen resultaten</div>
                    <div className="mt-1 text-xs text-slate-500">Pas je filters aan of wis ze om alles te zien.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-xs text-slate-500">
          <div>Toont {filtered.length} registraties</div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Check-in/out tijden bewerken</DialogTitle>
            <DialogDescription>
              {selectedRow && (
                <>
                  <span className="font-semibold">{selectedRow.student_name}</span> • {selectedRow.class_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Check-in tijd</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  value={editCheckIn ? (() => {
                    try {
                      return new Date(editCheckIn).toISOString().slice(0, 16);
                    } catch {
                      return "";
                    }
                  })() : ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      try {
                        setEditCheckIn(new Date(e.target.value).toISOString());
                      } catch (err) {
                        console.error("Invalid date:", err);
                      }
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Check-out tijd</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  value={editCheckOut ? (() => {
                    try {
                      return new Date(editCheckOut).toISOString().slice(0, 16);
                    } catch {
                      return "";
                    }
                  })() : ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      try {
                        setEditCheckOut(new Date(e.target.value).toISOString());
                      } catch (err) {
                        console.error("Invalid date:", err);
                      }
                    } else {
                      setEditCheckOut("");
                    }
                  }}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setEditModalOpen(false)}>
                  Annuleren
                </Button>
                <Button onClick={saveEdit}>
                  Opslaan
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
