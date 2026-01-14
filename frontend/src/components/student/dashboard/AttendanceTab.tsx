"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  Timer,
  Briefcase,
  Plus,
  CheckCircle2,
  XCircle,
  Hourglass,
  Info,
  Calendar,
} from "lucide-react";
import { studentStyles } from "@/styles/student-dashboard.styles";
import { 
  attendanceService, 
  type AttendanceEvent, 
  type AttendanceTotals, 
  type Project 
} from "@/services/attendance.service";

type PeriodFilter = "week" | "maand" | "alles";

interface AttendanceTabProps {
  searchQuery: string;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}`);
  parts.push(minutes.toString().padStart(hours > 0 ? 2 : 1, '0'));
  parts.push(secs.toString().padStart(2, '0'));
  
  return parts.join(':');
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function StatusPill({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <Badge className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" /> Goedgekeurd
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge className="rounded-full bg-amber-50 text-amber-800 border border-amber-200 gap-1">
        <Hourglass className="h-3.5 w-3.5" /> In afwachting
      </Badge>
    );
  }
  return (
    <Badge className="rounded-full bg-rose-50 text-rose-700 border border-rose-200 gap-1">
      <XCircle className="h-3.5 w-3.5" /> Afgekeurd
    </Badge>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "neutral" | "success" | "accent" | "warn" }) {
  const toneClass =
    tone === "success"
      ? "text-emerald-700"
      : tone === "accent"
        ? "text-indigo-600"
        : tone === "warn"
          ? "text-amber-800"
          : "text-slate-900";

  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="text-xs font-medium text-slate-600">{label}</div>
        <div className={`mt-1 text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function TableShell({ title, icon, right }: { title: string; icon: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-700">{icon}</div>
        <div className="text-base font-semibold text-slate-900">{title}</div>
      </div>
      {right}
    </div>
  );
}

function SmallHelp({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1 text-xs text-slate-600">
      <Info className="h-3.5 w-3.5" /> {children}
    </div>
  );
}

export function AttendanceTab({ searchQuery }: AttendanceTabProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [period, setPeriod] = useState<PeriodFilter>("week");
  const [showNewExternal, setShowNewExternal] = useState(false);
  const [expandedRejectId, setExpandedRejectId] = useState<number | null>(null);
  const [totals, setTotals] = useState<AttendanceTotals | null>(null);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Get project_id from URL params
  const projectIdFromUrl = searchParams.get("project_id");
  const [projectFilter, setProjectFilter] = useState<string>(projectIdFromUrl || "");
  
  const [formData, setFormData] = useState({
    location: "Thuis",
    description: "",
    start: "",
    end: "",
  });

  // Update project filter when URL changes
  useEffect(() => {
    setProjectFilter(projectIdFromUrl || "");
  }, [projectIdFromUrl]);

  // Load projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Reload data when period or project filter changes
  useEffect(() => {
    fetchData();
  }, [period, projectFilter]);

  const fetchProjects = async () => {
    try {
      const projectsData = await attendanceService.getMyProjects();
      setProjects(projectsData);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Prepare params for totals request
      const totalsParams = projectFilter ? { project_id: parseInt(projectFilter, 10) } : undefined;
      
      // Fetch totals
      const totalsData = await attendanceService.getMyAttendance(totalsParams);
      setTotals(totalsData);
      
      // Fetch events
      const now = new Date();
      let startDate: string | undefined;
      
      if (period === "week") {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDate = weekAgo.toISOString();
      } else if (period === "maand") {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startDate = monthAgo.toISOString();
      }
      
      // Prepare event list params
      const eventsParams: any = {
        start_date: startDate,
        per_page: 100,
      };
      
      // Note: We don't filter events by project_id because the backend 
      // doesn't support that for students, and we want to show all events
      // in the time period. The totals are filtered by project date range.
      
      const eventsData = await attendanceService.listEvents(eventsParams);
      setEvents(eventsData.events);
    } catch (error) {
      console.error("Error fetching attendance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectFilterChange = (value: string) => {
    setProjectFilter(value);
    
    // Update URL params
    const currentParams = new URLSearchParams(window.location.search);
    const currentTab = currentParams.get("tab");
    
    if (value) {
      currentParams.set("project_id", value);
    } else {
      currentParams.delete("project_id");
    }
    
    // Preserve the tab parameter
    if (currentTab) {
      currentParams.set("tab", currentTab);
    }
    
    router.push(`/student?${currentParams.toString()}`, { scroll: false });
  };

  const handleSubmitExternalWork = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.start || !formData.end || !formData.location || !formData.description) {
      alert("Vul alle velden in");
      return;
    }

    try {
      setSubmitting(true);
      await attendanceService.createExternalWork({
        check_in: new Date(formData.start).toISOString(),
        check_out: new Date(formData.end).toISOString(),
        location: formData.location,
        description: formData.description,
      });
      
      setShowNewExternal(false);
      setFormData({
        location: "Thuis",
        description: "",
        start: "",
        end: "",
      });
      fetchData();
    } catch (error) {
      console.error("Error submitting external work:", error);
      alert("Fout bij indienen");
    } finally {
      setSubmitting(false);
    }
  };

  // Split events into school sessions and external work
  const schoolSessions = useMemo(() => {
    return events.filter(e => !e.is_external && e.check_out !== null);
  }, [events]);

  const externalWork = useMemo(() => {
    return events.filter(e => e.is_external);
  }, [events]);

  // Filter by search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return schoolSessions;
    const q = searchQuery.toLowerCase();
    return schoolSessions.filter((s) => 
      formatDateTime(s.check_in).toLowerCase().includes(q) ||
      (s.check_out && formatDateTime(s.check_out).toLowerCase().includes(q)) ||
      (s.duration_seconds && formatDuration(s.duration_seconds).toLowerCase().includes(q))
    );
  }, [schoolSessions, searchQuery]);

  const filteredExternals = useMemo(() => {
    if (!searchQuery.trim()) return externalWork;
    const q = searchQuery.toLowerCase();
    return externalWork.filter((e) =>
      (e.location?.toLowerCase().includes(q)) ||
      (e.description?.toLowerCase().includes(q)) ||
      formatDateTime(e.check_in).toLowerCase().includes(q) ||
      (e.check_out && formatDateTime(e.check_out).toLowerCase().includes(q)) ||
      (e.approval_status?.toLowerCase().includes(q))
    );
  }, [externalWork, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Info card */}
      <Card className="rounded-2xl border-slate-200 bg-slate-50 shadow-none">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-2xl bg-white border border-slate-200 text-slate-700">
                <Timer className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">3de Blok – Aanwezigheid</div>
                <p className="mt-1 text-sm text-slate-600">
                  Bekijk je gewerkte tijd op school en registreer extern werk (bijv. thuis of bij een opdrachtgever).
                </p>
                <div className="mt-2">
                  <SmallHelp>75 min = 1 lesblok. Extern werk telt pas mee na goedkeuring.</SmallHelp>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={period === "week" ? "default" : "secondary"}
                className={`rounded-xl ${period === "week" ? "bg-slate-900 hover:bg-slate-800" : ""}`}
                size="sm"
                onClick={() => setPeriod("week")}
              >
                Deze week
              </Button>
              <Button
                variant={period === "maand" ? "default" : "secondary"}
                className={`rounded-xl ${period === "maand" ? "bg-slate-900 hover:bg-slate-800" : ""}`}
                size="sm"
                onClick={() => setPeriod("maand")}
              >
                Deze maand
              </Button>
              <Button
                variant={period === "alles" ? "default" : "secondary"}
                className={`rounded-xl ${period === "alles" ? "bg-slate-900 hover:bg-slate-800" : ""}`}
                size="sm"
                onClick={() => setPeriod("alles")}
              >
                Alles
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project filter */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <label className="text-sm font-medium text-slate-900 shrink-0">
              Filter op project:
            </label>
            <select
              className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              value={projectFilter}
              onChange={(e) => handleProjectFilterChange(e.target.value)}
            >
              <option value="">Alle projecten</option>
              {projects.map((project) => {
                let dateRange = '';
                try {
                  if (project.start_date && project.end_date) {
                    const startDate = new Date(project.start_date);
                    const endDate = new Date(project.end_date);
                    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                      dateRange = ` (${startDate.toLocaleDateString('nl-NL')} - ${endDate.toLocaleDateString('nl-NL')})`;
                    }
                  } else if (project.start_date) {
                    const startDate = new Date(project.start_date);
                    if (!isNaN(startDate.getTime())) {
                      dateRange = ` (vanaf ${startDate.toLocaleDateString('nl-NL')})`;
                    }
                  }
                } catch (error) {
                  // Silently ignore date parsing errors
                }
                return (
                  <option key={project.id} value={project.id}>
                    {project.title}{dateRange}
                  </option>
                );
              })}
            </select>
            {projectFilter && (
              <SmallHelp>
                Totalen en blokken tonen alleen gegevens binnen de projectperiode.
              </SmallHelp>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI grid */}
      {totals && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi 
            label="Schooltijd" 
            value={formatDuration(totals.total_school_seconds)} 
            tone="neutral" 
          />
          <Kpi 
            label="Externe tijd (goedgekeurd)" 
            value={formatDuration(totals.total_external_approved_seconds)} 
            tone="success" 
          />
          <Kpi 
            label="Totaal" 
            value={formatDuration(totals.total_school_seconds + totals.total_external_approved_seconds)} 
            tone="accent" 
          />
          <Kpi 
            label="Lesblokken (75 min)" 
            value={totals.lesson_blocks.toFixed(1)} 
            tone="warn" 
          />
        </div>
      )}

      {/* Sessions */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5 space-y-4">
          <TableShell 
            title="Aanwezigheidssessies" 
            icon={<Clock className="h-4 w-4" />} 
            right={<SmallHelp>Nieuwste bovenaan</SmallHelp>} 
          />

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-slate-600">
                  <th className="px-4 py-3 text-left font-medium">Check-in</th>
                  <th className="px-4 py-3 text-left font-medium">Check-out</th>
                  <th className="px-4 py-3 text-right font-medium">Gewerkte tijd</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((s) => (
                  <tr key={s.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">{formatDateTime(s.check_in)}</td>
                    <td className="px-4 py-3 text-slate-900">{s.check_out ? formatDateTime(s.check_out) : "—"}</td>
                    <td className="px-4 py-3 text-right text-slate-900 tabular-nums">
                      {s.duration_seconds ? formatDuration(s.duration_seconds) : "—"}
                    </td>
                  </tr>
                ))}
                {filteredSessions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-600">
                      Geen sessies gevonden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* External work */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5 space-y-4">
          <TableShell
            title="Externe werkregistraties"
            icon={<Briefcase className="h-4 w-4" />}
            right={
              <Button
                className="rounded-xl bg-slate-900 hover:bg-slate-800"
                size="sm"
                onClick={() => setShowNewExternal(true)}
              >
                <Plus className="mr-1 h-4 w-4" /> Nieuwe registratie
              </Button>
            }
          />

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-slate-600">
                  <th className="px-4 py-3 text-left font-medium">Locatie</th>
                  <th className="px-4 py-3 text-left font-medium">Omschrijving</th>
                  <th className="px-4 py-3 text-left font-medium">Start</th>
                  <th className="px-4 py-3 text-left font-medium">Eind</th>
                  <th className="px-4 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredExternals.map((e) => {
                  const isRejected = e.approval_status === "rejected";
                  const expanded = expandedRejectId === e.id;
                  return (
                    <React.Fragment key={e.id}>
                      <tr
                        className={`border-t border-slate-200 hover:bg-slate-50 ${isRejected ? "cursor-pointer" : ""}`}
                        onClick={() => {
                          if (isRejected) setExpandedRejectId(expanded ? null : e.id);
                        }}
                        title={isRejected ? "Klik om reden te bekijken" : undefined}
                      >
                        <td className="px-4 py-3 text-slate-900">{e.location || "—"}</td>
                        <td className="px-4 py-3 text-slate-900">{e.description || "—"}</td>
                        <td className="px-4 py-3 text-slate-900 tabular-nums">{formatDateTime(e.check_in)}</td>
                        <td className="px-4 py-3 text-slate-900 tabular-nums">
                          {e.check_out ? formatDateTime(e.check_out) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center justify-end">
                            <StatusPill status={e.approval_status || "pending"} />
                          </div>
                        </td>
                      </tr>
                      {isRejected && expanded && (
                        <tr className="border-t border-slate-200 bg-rose-50/40">
                          <td colSpan={5} className="px-4 py-3 text-sm text-slate-700">
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-xl bg-white border border-rose-200 text-rose-700">
                                <XCircle className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-slate-900">Waarom afgekeurd?</div>
                                <p className="mt-1 text-sm text-slate-700">{e.description || "Geen reden meegegeven."}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filteredExternals.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-600">
                      Geen registraties gevonden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <SmallHelp>Klik op een afgekeurde registratie om de reden te bekijken.</SmallHelp>
          </div>
        </CardContent>
      </Card>

      {/* Modal: nieuwe registratie */}
      <Dialog open={showNewExternal} onOpenChange={setShowNewExternal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nieuwe externe registratie</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitExternalWork} className="space-y-4">
            <div className="grid gap-3">
              <label className="text-sm font-medium text-slate-900">Locatie</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formData.location === "Thuis" ? "default" : "secondary"}
                  className={`rounded-xl ${formData.location === "Thuis" ? "bg-slate-900 hover:bg-slate-800" : ""}`}
                  size="sm"
                  onClick={() => setFormData({ ...formData, location: "Thuis" })}
                >
                  Thuis
                </Button>
                <Button
                  type="button"
                  variant={formData.location === "Opdrachtgever" ? "default" : "secondary"}
                  className={`rounded-xl ${formData.location === "Opdrachtgever" ? "bg-slate-900 hover:bg-slate-800" : ""}`}
                  size="sm"
                  onClick={() => setFormData({ ...formData, location: "Opdrachtgever" })}
                >
                  Opdrachtgever
                </Button>
                <Button
                  type="button"
                  variant={formData.location === "Anders" ? "default" : "secondary"}
                  className={`rounded-xl ${formData.location === "Anders" ? "bg-slate-900 hover:bg-slate-800" : ""}`}
                  size="sm"
                  onClick={() => setFormData({ ...formData, location: "Anders" })}
                >
                  Anders
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-900">Omschrijving</label>
              <Textarea
                className="rounded-2xl border-slate-200 min-h-[100px]"
                placeholder="Bijv. interview, bouwen, documenteren…"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-900">Start</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                  <Input
                    type="datetime-local"
                    className="h-10 rounded-2xl border-slate-200 pl-9"
                    value={formData.start}
                    onChange={(e) => setFormData({ ...formData, start: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-900">Eind</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                  <Input
                    type="datetime-local"
                    className="h-10 rounded-2xl border-slate-200 pl-9"
                    value={formData.end}
                    onChange={(e) => setFormData({ ...formData, end: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-xl bg-white border border-slate-200 text-slate-700">
                  <Info className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Na opslaan</div>
                  <p className="mt-1 text-sm text-slate-600">
                    Je registratie komt op <b>In afwachting</b> te staan. Extern werk telt pas mee na goedkeuring.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl"
                onClick={() => setShowNewExternal(false)}
                disabled={submitting}
              >
                Annuleren
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-slate-900 hover:bg-slate-800"
                disabled={submitting}
              >
                {submitting ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
