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
  Check,
  X,
  Download,
  Clock,
  Ban,
  Trash2,
} from "lucide-react";
import { attendanceService, type AttendanceEvent } from "@/services/attendance.service";
import { toast } from "@/lib/toast";

type Status = "pending" | "approved" | "rejected";

interface ExternalWorkRow {
  id: number;
  student_name: string;
  class_name: string;
  location: string;
  description: string;
  start: string;
  end: string;
  duration: string;
  status: Status;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: "In afwachting",
  approved: "Goedgekeurd",
  rejected: "Afgewezen",
};

const STATUS_BADGE: Record<Status, { ring: string; bg: string; text: string }> = {
  pending: {
    ring: "ring-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-800",
  },
  approved: {
    ring: "ring-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-800",
  },
  rejected: {
    ring: "ring-rose-200",
    bg: "bg-rose-50",
    text: "text-rose-800",
  },
};

function StatusPill({ status }: { status: Status }) {
  const s = STATUS_BADGE[status];
  const icon =
    status === "approved" ? (
      <Check className="h-4 w-4" />
    ) : status === "rejected" ? (
      <X className="h-4 w-4" />
    ) : (
      <Clock className="h-4 w-4" />
    );

  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ring-1 ${s.bg} ${s.text} ${s.ring}`}
      title={STATUS_LABEL[status]}
    >
      {icon}
      <span>{STATUS_LABEL[status]}</span>
    </span>
  );
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

function calculateDuration(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

export default function ExternTab() {
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [nameQuery, setNameQuery] = useState("");
  const [classQuery, setClassQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ExternalWorkRow | null>(null);

  useEffect(() => {
    fetchExternalWork();
  }, []);

  const fetchExternalWork = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = {
        is_external: true,
        per_page: 100,
      };

      const response = await attendanceService.listEvents(params);
      setEvents(response.events);
    } catch (err) {
      console.error("Error fetching external work:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Kon extern werk niet ophalen: ${errorMessage}`);
      toast.error("Kon extern werk niet ophalen");
    } finally {
      setLoading(false);
    }
  };

  // Transform events to rows with user data
  const rows: ExternalWorkRow[] = useMemo(() => {
    return events.map((event) => ({
      id: event.id,
      student_name: (event as any).user_name || `User #${event.user_id}`,
      class_name: (event as any).user_class || "-",
      location: event.location || "Onbekend",
      description: event.description || "",
      start: event.check_in,
      end: event.check_out || event.check_in,
      duration: event.check_out ? calculateDuration(event.check_in, event.check_out) : "-",
      status: (event.approval_status as Status) || "pending",
    }));
  }, [events]);

  const filtered = useMemo(() => {
    const nq = nameQuery.trim().toLowerCase();
    const cq = classQuery.trim().toLowerCase();
    return rows.filter((r) => {
      const matchName = !nq || r.student_name.toLowerCase().includes(nq);
      const matchClass = !cq || r.class_name.toLowerCase().includes(cq);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchName && matchClass && matchStatus;
    });
  }, [rows, nameQuery, classQuery, statusFilter]);

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
    if (statusFilter !== "all")
      chips.push({
        key: "status",
        text: `Status: ${STATUS_LABEL[statusFilter]}`,
        clear: () => setStatusFilter("all"),
      });
    return chips;
  }, [nameQuery, classQuery, statusFilter]);

  async function handleStatusChange(id: number, newStatus: Status) {
    try {
      if (newStatus === "approved") {
        await attendanceService.approveExternalWork(id);
      } else if (newStatus === "rejected") {
        await attendanceService.rejectExternalWork(id);
      }
      await fetchExternalWork();
      toast.success(`Status bijgewerkt naar ${STATUS_LABEL[newStatus]}`);
    } catch (err) {
      console.error("Error updating status:", err);
      toast.error("Kon status niet bijwerken");
    }
  }

  async function bulkSetStatus(status: Status) {
    if (selectedCount === 0) return;
    
    try {
      if (status === "approved") {
        await attendanceService.bulkApproveExternalWork(selectedIds);
        toast.success(`${selectedCount} registraties goedgekeurd`);
      } else if (status === "rejected") {
        // Bulk reject - need to implement
        for (const id of selectedIds) {
          await attendanceService.rejectExternalWork(id);
        }
        toast.success(`${selectedCount} registraties afgewezen`);
      }
      setSelected({});
      await fetchExternalWork();
    } catch (err) {
      console.error("Error in bulk operation:", err);
      toast.error("Fout bij bulkoperatie");
    }
  }

  async function bulkDelete() {
    if (selectedCount === 0) return;
    
    if (!confirm(`Weet je zeker dat je ${selectedCount} registratie(s) wilt verwijderen?`)) {
      return;
    }

    try {
      await attendanceService.bulkDeleteEvents(selectedIds);
      setSelected({});
      await fetchExternalWork();
      toast.success(`${selectedCount} registraties verwijderd`);
    } catch (err) {
      console.error("Error deleting:", err);
      toast.error("Kon registraties niet verwijderen");
    }
  }

  async function approveAllFilteredPending() {
    const pendingFiltered = filtered.filter((r) => r.status === "pending");
    if (pendingFiltered.length === 0) {
      toast.info("Geen in afwachting registraties gevonden");
      return;
    }

    if (!confirm(`Weet je zeker dat je alle ${pendingFiltered.length} in afwachting registraties wilt goedkeuren?`)) {
      return;
    }

    try {
      const ids = pendingFiltered.map((r) => r.id);
      await attendanceService.bulkApproveExternalWork(ids);
      toast.success(`${ids.length} registraties goedgekeurd`);
      await fetchExternalWork();
    } catch (err) {
      console.error("Error approving filtered pending:", err);
      toast.error("Kon registraties niet goedkeuren");
    }
  }

  function exportCsv() {
    const header = ["Naam", "Klas", "Locatie", "Omschrijving", "Start", "Eind", "Duur", "Status"].join(",");
    const lines = filtered.map((r) =>
      [
        r.student_name,
        r.class_name,
        r.location,
        r.description.replaceAll("\n", " ").replaceAll(",", ";"),
        formatDateTime(r.start),
        formatDateTime(r.end),
        r.duration,
        STATUS_LABEL[r.status],
      ].join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extern-werk.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV geëxporteerd");
  }

  function openDetailModal(row: ExternalWorkRow) {
    setSelectedRow(row);
    setDetailModalOpen(true);
  }

  if (loading) {
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
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100 md:w-44"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">Alle</option>
                <option value="pending">In afwachting</option>
                <option value="approved">Goedgekeurd</option>
                <option value="rejected">Afgewezen</option>
              </select>
            </div>

            <div className="flex shrink-0 items-center gap-2 md:ml-auto">
              <Button variant="secondary" onClick={() => setStatusFilter("pending")} className="gap-2">
                <Clock className="h-4 w-4" />
                Alle in afwachting
              </Button>
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
              onClick={() => bulkSetStatus("approved")}
              disabled={selectedCount === 0}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs h-auto"
            >
              <Check className="h-4 w-4" />
              Goedkeuren
            </Button>
            <Button
              onClick={() => bulkSetStatus("rejected")}
              disabled={selectedCount === 0}
              className="gap-2 bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs h-auto"
            >
              <Ban className="h-4 w-4" />
              Afwijzen
            </Button>
            <Button
              onClick={bulkDelete}
              disabled={selectedCount === 0}
              className="gap-2 bg-rose-600 hover:bg-rose-700 px-3 py-1.5 text-xs h-auto"
            >
              <Trash2 className="h-4 w-4" />
              Verwijderen
            </Button>
            <Button variant="secondary" onClick={approveAllFilteredPending} className="gap-2 px-3 py-1.5 text-xs h-auto">
              <Check className="h-4 w-4" />
              Goedkeur pending
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Externe werkregistraties</div>
            <div className="text-xs text-slate-500">Beheer en review per leerling</div>
          </div>
          <Button variant="secondary" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
        </div>

        <div className="overflow-x-auto">
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
                <th className="px-5 py-3 w-20">Locatie</th>
                <th className="px-5 py-3 w-[44%]">Omschrijving</th>
                <th className="px-5 py-3 w-28">Starttijd</th>
                <th className="px-5 py-3 w-28">Eindtijd</th>
                <th className="px-5 py-3 w-20">Tijd</th>
                <th className="px-5 py-3 w-36">Status</th>
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
                    <span className="text-sm text-slate-700">{r.location}</span>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="text-sm text-slate-800">
                      <span className="line-clamp-2">{r.description}</span>
                    </div>
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                      onClick={() => openDetailModal(r)}
                    >
                      Lees meer
                    </button>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="text-xs text-slate-700">{formatDateTime(r.start)}</div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="text-xs text-slate-700">{formatDateTime(r.end)}</div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="text-xs font-semibold text-slate-900">{r.duration}</div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="flex items-center gap-2">
                      <StatusPill status={r.status} />
                      <select
                        className="h-9 w-28 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                        value={r.status}
                        onChange={(e) => handleStatusChange(r.id, e.target.value as Status)}
                        aria-label={`Wijzig status voor ${r.student_name}`}
                      >
                        <option value="pending">In afwachting</option>
                        <option value="approved">Goedgekeurd</option>
                        <option value="rejected">Afgewezen</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center">
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

      {/* Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Externe werkregistratie</DialogTitle>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-600">Locatie</div>
                  <div className="text-sm text-slate-900">{selectedRow.location}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-600">Status</div>
                  <div className="mt-1">
                    <StatusPill status={selectedRow.status} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-600">Starttijd</div>
                  <div className="text-sm text-slate-900">{formatDateTime(selectedRow.start)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-600">Eindtijd</div>
                  <div className="text-sm text-slate-900">{formatDateTime(selectedRow.end)}</div>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Duur</div>
                <div className="text-sm text-slate-900">{selectedRow.duration}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600 mb-2">Omschrijving</div>
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-800 whitespace-pre-wrap">
                  {selectedRow.description}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
