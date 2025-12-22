"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Search,
  ShieldCheck,
  ShieldX,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users
} from "lucide-react";
import { rfidService } from "@/services/attendance.service";
import { fetchWithErrorHandling } from "@/lib/api";
import {
  type StudentWithCards,
  type StudentRow,
  type SortKey,
  type SortDir,
  buildStudentRows,
  filterRows,
  sortRows,
  getInitials,
  getPrimaryCardHint,
  DEFAULT_CARD_LABEL,
} from "./rfid-helpers";

export default function RFIDTab() {
  const [students, setStudents] = useState<StudentWithCards[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [openRowId, setOpenRowId] = useState<number | null>(null);
  const [addDialogStudent, setAddDialogStudent] = useState<StudentRow | null>(null);
  const [newCardData, setNewCardData] = useState({ uid: "", label: DEFAULT_CARD_LABEL });
  const [submitting, setSubmitting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    fetchStudentsAndCards();
  }, []);

  const fetchStudentsAndCards = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetchWithErrorHandling("/api/v1/attendance/students");
      const data = await response.json();
      setStudents(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error fetching students:", err);
      setError(`Kon studenten niet ophalen: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async () => {
    if (!addDialogStudent || !newCardData.uid.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      await rfidService.createCard(addDialogStudent.id, {
        uid: newCardData.uid.trim().toUpperCase(),
        label: newCardData.label || undefined,
        is_active: true,
      });
      
      setAddDialogStudent(null);
      setNewCardData({ uid: "", label: DEFAULT_CARD_LABEL });
      await fetchStudentsAndCards();
    } catch (err) {
      console.error("Error adding card:", err);
      alert("Fout bij toevoegen kaart - mogelijk bestaat deze UID al");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (cardId: number, currentStatus: boolean) => {
    try {
      await rfidService.updateCard(cardId, { is_active: !currentStatus });
      await fetchStudentsAndCards();
    } catch (err) {
      console.error("Error updating card:", err);
      alert("Fout bij bijwerken kaart");
    }
  };

  const handleDeleteCard = async (cardId: number) => {
    if (!confirm("Weet je zeker dat je deze kaart wilt verwijderen?")) {
      return;
    }

    try {
      await rfidService.deleteCard(cardId);
      await fetchStudentsAndCards();
    } catch (err) {
      console.error("Error deleting card:", err);
      alert("Fout bij verwijderen kaart");
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    }
    return sortDir === 'asc' 
      ? <ArrowUp className="h-3.5 w-3.5 ml-1" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  const rows = useMemo(() => {
    const studentRows = buildStudentRows(students);
    const filtered = filterRows(studentRows, searchQuery);
    return sortRows(filtered, sortKey, sortDir);
  }, [students, searchQuery, sortKey, sortDir]);

  const totalCards = useMemo(() => students.reduce((acc, s) => acc + s.cards.length, 0), [students]);
  const studentsWithoutCards = useMemo(() => students.filter(s => s.cards.length === 0).length, [students]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Studenten laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-gray-200/80 rounded-xl p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Summary badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1 rounded-full">
          <Users className="h-3.5 w-3.5" />
          {students.length} leerlingen
        </Badge>
        <Badge variant="secondary" className="rounded-full">{totalCards} kaarten</Badge>
        <Badge variant="secondary" className="rounded-full">{studentsWithoutCards} zonder kaart</Badge>
      </div>

      {/* Search bar */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek op naam, email, klas of UID…"
            className="pl-9"
          />
        </div>
        <Button 
          variant="secondary" 
          className="h-9" 
          onClick={() => setSearchQuery("")}
          disabled={!searchQuery.trim()}
        >
          Wissen
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {/* Table header */}
        <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold tracking-wide text-slate-500">
          <button
            onClick={() => handleSort('name')}
            className="col-span-5 flex items-center gap-1 text-left hover:text-slate-900 transition-colors"
          >
            <span>Leerling</span>
            {getSortIcon('name')}
          </button>
          <button
            onClick={() => handleSort('className')}
            className="col-span-2 flex items-center gap-1 text-left hover:text-slate-900 transition-colors"
          >
            <span>Klas</span>
            {getSortIcon('className')}
          </button>
          <button
            onClick={() => handleSort('cardCount')}
            className="col-span-2 flex items-center gap-1 text-left hover:text-slate-900 transition-colors"
          >
            <span>Kaarten</span>
            {getSortIcon('cardCount')}
          </button>
          <div className="col-span-3 text-right uppercase">ACTIES</div>
        </div>

        {/* Table body */}
        <div className="divide-y divide-slate-200">
          {rows.map((row) => {
            const isOpen = openRowId === row.id;
            const primaryHint = getPrimaryCardHint(row.cards);

            return (
              <div key={row.id} className="group">
                {/* Row */}
                <div
                  onClick={() => setOpenRowId(isOpen ? null : row.id)}
                  className="grid w-full grid-cols-12 items-center px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="col-span-5 flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                      {getInitials(row.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-medium text-slate-900">{row.name}</div>
                        {row.cards.length === 0 && (
                          <Badge variant="outline" className="rounded-full text-[11px] border-slate-300 text-slate-600">
                            Geen kaart
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    {row.className ? (
                      <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700">{row.className}</Badge>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </div>

                  <div className="col-span-2">
                    <div className="text-sm font-medium text-slate-900">{row.cards.length}</div>
                    <div className="truncate text-xs text-slate-500">{primaryHint}</div>
                  </div>

                  <div className="col-span-3 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddDialogStudent(row);
                        setNewCardData({ uid: "", label: DEFAULT_CARD_LABEL });
                      }}
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Kaart toevoegen
                    </Button>
                    <div className="text-slate-500">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="bg-slate-50 px-3 py-3 border-t border-slate-200">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="text-xs text-slate-600">
                        Kaarten van <span className="font-medium text-slate-900">{row.name}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Tip: koppel meerdere kaarten (backup) en deactiveer i.p.v. verwijderen.
                      </div>
                    </div>

                    <Separator className="my-3 bg-slate-200" />

                    {row.cards.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                        <div className="font-medium text-slate-900">Geen kaarten gekoppeld</div>
                        <div className="text-xs text-slate-500">
                          Voeg een kaart toe om in-/uitchecken via RFID te activeren.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {row.cards.map((card) => (
                          <div
                            key={card.id}
                            className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="font-mono text-sm font-semibold tracking-tight text-slate-900">{card.uid}</div>
                                {card.is_active ? (
                                  <Badge className="gap-1 rounded-full px-2 py-0.5 text-[11px] bg-blue-600 text-white">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    Actief
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="gap-1 rounded-full px-2 py-0.5 text-[11px] bg-slate-100 text-slate-700">
                                    <ShieldX className="h-3.5 w-3.5" />
                                    Inactief
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-slate-500">{card.label || "—"}</div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className="h-8 bg-slate-100 hover:bg-slate-200 text-slate-700"
                                onClick={() => handleToggleActive(card.id, card.is_active)}
                              >
                                {card.is_active ? "Deactiveren" : "Activeren"}
                              </Button>
                              <Button 
                                size="icon" 
                                variant="outline" 
                                className="h-8 w-8 border-slate-300" 
                                title="Verwijderen"
                                onClick={() => handleDeleteCard(card.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="px-3 py-10 text-center">
              <div className="text-sm font-medium text-slate-900">Geen resultaten</div>
              <div className="text-xs text-slate-500">Pas je zoekterm aan of wis de filter.</div>
              <div className="mt-3">
                <Button variant="secondary" onClick={() => setSearchQuery("")} disabled={!searchQuery.trim()}>
                  Wissen
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add card dialog */}
      <Dialog open={!!addDialogStudent} onOpenChange={(v) => !v && setAddDialogStudent(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Kaart toevoegen</DialogTitle>
            <DialogDescription>
              Koppel een RFID UID aan <span className="font-medium text-foreground">{addDialogStudent?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="uid">UID</Label>
              <Input
                id="uid"
                value={newCardData.uid}
                onChange={(e) => setNewCardData({ ...newCardData, uid: e.target.value.toUpperCase() })}
                placeholder="Bijv. ABC123DEF456"
              />
              <p className="text-xs text-muted-foreground">
                Tip: scan met je device en plak de UID hier, of typ hem over van de kaart. UID wordt automatisch in hoofdletters omgezet.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={newCardData.label}
                onChange={(e) => setNewCardData({ ...newCardData, label: e.target.value })}
                placeholder="Hoofdkaart / Backup kaart"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="secondary" onClick={() => setAddDialogStudent(null)} disabled={submitting}>
              Annuleren
            </Button>
            <Button
              onClick={handleAddCard}
              disabled={!newCardData.uid.trim() || submitting}
            >
              {submitting ? "Opslaan..." : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
