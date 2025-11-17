"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { evaluationService, projectService, competencyService } from "@/services";
import type { ProjectListItem } from "@/dtos/project.dto";
import { Loading } from "@/components";
import { formatDate } from "@/utils";

type EventType = "project_start" | "project_end" | "peer_deadline_review" | "peer_deadline_reflection" | "competency_deadline" | "project_note" | "reminder";

type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  date: Date;
  endDate?: Date;
  type: EventType;
  status?: "not_started" | "in_progress" | "completed";
  projectName?: string;
  courseName?: string;
  link?: string;
  metadata?: {
    projectId?: number;
    courseId?: number;
    evaluationId?: number;
    windowId?: number;
  };
};

type ViewMode = "week" | "month" | "agenda";

const EVENT_ICONS: Record<EventType, string> = {
  project_start: "🚀",
  project_end: "🏁",
  peer_deadline_review: "📝",
  peer_deadline_reflection: "💭",
  competency_deadline: "🎯",
  project_note: "📋",
  reminder: "🔔",
};

const EVENT_LABELS: Record<EventType, string> = {
  project_start: "Project start",
  project_end: "Project einde",
  peer_deadline_review: "Peer-evaluatie deadline",
  peer_deadline_reflection: "Reflectie deadline",
  competency_deadline: "Competentiescan deadline",
  project_note: "Projectaantekening",
  reminder: "Reminder",
};

const STATUS_COLORS = {
  not_started: "bg-gray-100 border-gray-300 text-gray-700",
  in_progress: "bg-yellow-50 border-yellow-300 text-yellow-800",
  completed: "bg-green-50 border-green-300 text-green-700",
};

export default function CalendarPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedEventType, setSelectedEventType] = useState<string>("all");
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [courses, setCourses] = useState<{ id: number; name: string }[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    loadCalendarData();
  }, []);

  async function loadCalendarData() {
    setLoading(true);
    try {
      const [evalsData, projectsData, windowsData] = await Promise.all([
        evaluationService.getEvaluations({}),
        projectService.listProjects({ per_page: 100 }),
        competencyService.getWindows("open"),
      ]);

      const evaluations = Array.isArray(evalsData) ? evalsData : [];
      const projectsList = projectsData?.items || [];
      const windows = Array.isArray(windowsData) ? windowsData : [];

      setProjects(projectsList);

      // Extract unique courses
      const courseMap = new Map<number, string>();
      evaluations.forEach((e) => {
        if (e.course_id && e.cluster) {
          courseMap.set(e.course_id, e.cluster);
        }
      });
      projectsList.forEach((p) => {
        if (p.course_id) {
          courseMap.set(p.course_id, `Course ${p.course_id}`);
        }
      });
      setCourses(Array.from(courseMap.entries()).map(([id, name]) => ({ id, name })));

      // Generate calendar events
      const calendarEvents: CalendarEvent[] = [];

      // Add project events
      projectsList.forEach((project) => {
        if (project.start_date) {
          calendarEvents.push({
            id: `project-start-${project.id}`,
            title: `${project.title} - Start`,
            description: `Project begint`,
            date: new Date(project.start_date),
            type: "project_start",
            status: project.status === "active" ? "in_progress" : project.status === "completed" ? "completed" : "not_started",
            projectName: project.title,
            courseName: project.course_id ? `Course ${project.course_id}` : undefined,
            link: `/teacher/projects/${project.id}`,
            metadata: { projectId: project.id, courseId: project.course_id },
          });
        }

        if (project.end_date) {
          calendarEvents.push({
            id: `project-end-${project.id}`,
            title: `${project.title} - Einde`,
            description: `Project eindigt`,
            date: new Date(project.end_date),
            type: "project_end",
            status: project.status === "completed" ? "completed" : new Date(project.end_date) < new Date() ? "completed" : "not_started",
            projectName: project.title,
            courseName: project.course_id ? `Course ${project.course_id}` : undefined,
            link: `/teacher/projects/${project.id}`,
            metadata: { projectId: project.id, courseId: project.course_id },
          });
        }
      });

      // Add evaluation events
      evaluations.forEach((evaluation) => {
        const reviewDeadline = evaluation.deadlines?.review;
        const reflectionDeadline = evaluation.deadlines?.reflection;

        if (reviewDeadline) {
          calendarEvents.push({
            id: `eval-review-${evaluation.id}`,
            title: `${evaluation.title} - Review`,
            description: `Peer-evaluatie review deadline`,
            date: new Date(reviewDeadline),
            type: "peer_deadline_review",
            status: evaluation.status === "closed" ? "completed" : evaluation.status === "open" ? "in_progress" : "not_started",
            courseName: evaluation.cluster,
            link: `/teacher/evaluations/${evaluation.id}/dashboard`,
            metadata: { evaluationId: evaluation.id, courseId: evaluation.course_id },
          });
        }

        if (reflectionDeadline) {
          calendarEvents.push({
            id: `eval-reflection-${evaluation.id}`,
            title: `${evaluation.title} - Reflectie`,
            description: `Reflectie deadline`,
            date: new Date(reflectionDeadline),
            type: "peer_deadline_reflection",
            status: evaluation.status === "closed" ? "completed" : evaluation.status === "open" ? "in_progress" : "not_started",
            courseName: evaluation.cluster,
            link: `/teacher/evaluations/${evaluation.id}/dashboard`,
            metadata: { evaluationId: evaluation.id, courseId: evaluation.course_id },
          });
        }
      });

      // Add competency window events
      windows.forEach((window) => {
        if (window.end_date) {
          calendarEvents.push({
            id: `competency-${window.id}`,
            title: `${window.title}`,
            description: `Competentiescan deadline`,
            date: new Date(window.end_date),
            type: "competency_deadline",
            status: window.status === "closed" ? "completed" : window.status === "open" ? "in_progress" : "not_started",
            courseName: window.course_id ? `Course ${window.course_id}` : undefined,
            link: `/teacher/competencies/windows/${window.id}`,
            metadata: { windowId: window.id, courseId: window.course_id },
          });
        }
      });

      // Sort events by date
      calendarEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

      setEvents(calendarEvents);
    } catch (error) {
      console.error("Error loading calendar data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Filter events based on selected filters
  const filteredEvents = events.filter((event) => {
    if (selectedProject !== "all" && event.metadata?.projectId?.toString() !== selectedProject) {
      return false;
    }
    if (selectedCourse !== "all" && event.metadata?.courseId?.toString() !== selectedCourse) {
      return false;
    }
    if (selectedEventType !== "all" && event.type !== selectedEventType) {
      return false;
    }
    return true;
  });

  // Get events for current view
  const getEventsForView = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === "week") {
      start.setDate(start.getDate() - start.getDay());
      end.setDate(start.getDate() + 7);
    } else if (viewMode === "month") {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    } else {
      // agenda view - show all future events
      return filteredEvents.filter((e) => e.date >= new Date());
    }

    return filteredEvents.filter((e) => e.date >= start && e.date <= end);
  };

  const viewEvents = getEventsForView();

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    } else if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  if (loading) {
    return (
      <main className="p-6 max-w-7xl mx-auto">
        <Loading />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Page Header */}
      <header className="bg-white/80 border-b border-slate-200 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-5 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Kalender</h1>
            <p className="text-sm text-slate-600 mt-1">
              Overzicht van projecten, evaluaties en deadlines.
            </p>
          </div>
        </div>
      </header>

      {/* Main Layout - Two Column Grid */}
      <main className="mx-auto max-w-7xl px-6 py-6 grid gap-6 sm:grid-cols-12">
        {/* LEFT COLUMN - Filters and Quick Actions */}
        <aside className="space-y-4 sm:col-span-4 lg:col-span-3">
          {/* Filters Section */}
          <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
            {/* View Mode Selector */}
            <div>
              <p className="uppercase text-xs tracking-wide font-semibold text-slate-500 mb-2">Weergave</p>
              <div className="inline-flex bg-slate-100 rounded-full p-1 text-xs font-medium">
                <button
                  onClick={() => setViewMode("month")}
                  className={`px-3 py-1 rounded-full transition-all ${
                    viewMode === "month" ? "bg-white shadow-sm" : ""
                  }`}
                >
                  📆 Maand
                </button>
                <button
                  onClick={() => setViewMode("week")}
                  className={`px-3 py-1 rounded-full transition-all ${
                    viewMode === "week" ? "bg-white shadow-sm" : ""
                  }`}
                >
                  📅 Week
                </button>
                <button
                  onClick={() => setViewMode("agenda")}
                  className={`px-3 py-1 rounded-full transition-all ${
                    viewMode === "agenda" ? "bg-white shadow-sm" : ""
                  }`}
                >
                  📋 Agenda
                </button>
              </div>
            </div>

            {/* Project Filter */}
            <div className="space-y-1 text-sm">
              <label className="text-xs font-medium text-slate-500">Project</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 shadow-inner text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Alle projecten</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id.toString()}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Course Filter */}
            <div className="space-y-1 text-sm">
              <label className="text-xs font-medium text-slate-500">Vak / klas</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 shadow-inner text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Alle vakken</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id.toString()}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Event Type Filter */}
            <div className="space-y-1 text-sm">
              <label className="text-xs font-medium text-slate-500">Type event</label>
              <select
                value={selectedEventType}
                onChange={(e) => setSelectedEventType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 shadow-inner text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Alle events</option>
                <option value="project_start">Project start</option>
                <option value="project_end">Project einde</option>
                <option value="peer_deadline_review">Peer-evaluatie deadline</option>
                <option value="peer_deadline_reflection">Reflectie deadline</option>
                <option value="competency_deadline">Competentiescan deadline</option>
              </select>
            </div>
          </section>

          {/* Quick Actions Section */}
          <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <h2 className="uppercase tracking-wide text-xs font-semibold text-slate-500 mb-3">
              Snelle acties
            </h2>
            <div className="flex flex-col gap-2">
              <Link
                href="/teacher/projects/new"
                className="rounded-xl px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium shadow hover:from-blue-700 hover:to-indigo-700 text-center"
              >
                Nieuw project
              </Link>
              <Link
                href="/teacher/project-assessments/create"
                className="rounded-xl px-3 py-2 bg-blue-50 border border-blue-100 text-blue-900 text-sm font-medium hover:bg-blue-100 text-center"
              >
                Nieuwe projectbeoordeling
              </Link>
              <Link
                href="/teacher/evaluations/create"
                className="rounded-xl px-3 py-2 bg-white border border-slate-200 text-sm hover:bg-slate-50 text-center"
              >
                Nieuwe peerevaluatie
              </Link>
              <Link
                href="/teacher/competencies/windows/create"
                className="rounded-xl px-3 py-2 bg-white border border-slate-200 text-sm hover:bg-slate-50 text-center"
              >
                Nieuw competentievenster
              </Link>
            </div>
          </section>
        </aside>

        {/* RIGHT COLUMN - Calendar */}
        <section className="space-y-4 sm:col-span-8 lg:col-span-9">
          {/* Navigation Bar Above Calendar */}
          {viewMode !== "agenda" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between shadow-sm">
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => navigateDate("prev")}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
                >
                  ← Vorige
                </button>
                <button
                  onClick={goToToday}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Vandaag
                </button>
                <button
                  onClick={() => navigateDate("next")}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
                >
                  Volgende →
                </button>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">
                  {viewMode === "month"
                    ? currentDate.toLocaleDateString("nl-NL", { month: "long", year: "numeric" })
                    : `Week van ${currentDate.toLocaleDateString("nl-NL")}`}
                </p>
                {viewMode === "month" && (
                  <p className="text-xs text-slate-500">Zaterdag en zondag zijn verborgen</p>
                )}
              </div>
            </div>
          )}

          {/* Calendar View */}
          <div className="space-y-3">
            {viewMode === "agenda" ? (
              <AgendaView events={viewEvents} onEventClick={setSelectedEvent} />
            ) : viewMode === "week" ? (
              <WeekView events={viewEvents} currentDate={currentDate} onEventClick={setSelectedEvent} />
            ) : (
              <MonthView events={viewEvents} currentDate={currentDate} onEventClick={setSelectedEvent} />
            )}

            {/* Legend Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-[11px] text-slate-700 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-full">
                🚀 Project start
              </span>
              <span className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-full">
                🏁 Project einde
              </span>
              <span className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-full">
                📝 Peer-review
              </span>
              <span className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-full">
                💭 Reflectie
              </span>
              <span className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-full">
                🎯 Competentiescan
              </span>
              <span className="inline-flex items-center gap-1 bg-slate-200 px-2 py-1 rounded-full">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                Niet gestart
              </span>
              <span className="inline-flex items-center gap-1 bg-amber-100 px-2 py-1 rounded-full">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Bezig
              </span>
              <span className="inline-flex items-center gap-1 bg-emerald-100 px-2 py-1 rounded-full">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Afgerond
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}

// Agenda View Component
function AgendaView({ events, onEventClick }: { events: CalendarEvent[]; onEventClick: (event: CalendarEvent) => void }) {
  if (events.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <p className="text-slate-500 text-center py-8">Geen aankomende events.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            onClick={() => onEventClick(event)}
            className={`p-4 border-2 rounded-xl cursor-pointer hover:shadow-md transition-all ${
              event.status === "completed"
                ? "bg-emerald-50 border-emerald-200"
                : event.status === "in_progress"
                ? "bg-amber-50 border-amber-200"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{EVENT_ICONS[event.type]}</span>
                  <h3 className="font-semibold text-slate-900">{event.title}</h3>
                  {event.status && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        event.status === "completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : event.status === "in_progress"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {event.status === "completed" ? "✓ Afgerond" : event.status === "in_progress" ? "⏳ Bezig" : "○ Niet gestart"}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-600 mb-1">{event.description}</div>
                <div className="text-xs text-slate-500">
                  {formatDate(event.date.toISOString())}
                  {event.courseName && ` • ${event.courseName}`}
                  {event.projectName && ` • ${event.projectName}`}
                </div>
              </div>
              <div className="text-right text-sm text-blue-600 hover:underline">
                Details →
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Week View Component (Weekdays Only - Monday to Friday)
function WeekView({ events, currentDate, onEventClick }: { events: CalendarEvent[]; currentDate: Date; onEventClick: (event: CalendarEvent) => void }) {
  // Find the Monday of the current week
  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  startOfWeek.setDate(diff);

  // Create array of 5 weekdays (Monday-Friday)
  const days = Array.from({ length: 5 }, (_, i) => {
    const day = new Date(startOfWeek);
    day.setDate(day.getDate() + i);
    return day;
  });

  const getEventsForDay = (day: Date) => {
    return events.filter((e) => {
      const eventDate = new Date(e.date);
      return (
        eventDate.getDate() === day.getDate() &&
        eventDate.getMonth() === day.getMonth() &&
        eventDate.getFullYear() === day.getFullYear()
      );
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="grid grid-cols-5 gap-3">
        {days.map((day, i) => {
          const dayEvents = getEventsForDay(day);
          const isToday = day.toDateString() === new Date().toDateString();

          return (
            <div
              key={i}
              className={`border rounded-xl p-3 min-h-[200px] ${
                isToday ? "border-blue-500 bg-blue-50" : "border-slate-200"
              }`}
            >
              <div className={`text-center mb-3 ${isToday ? "text-blue-700" : ""}`}>
                <div className="text-xs font-medium text-slate-500">
                  {day.toLocaleDateString("nl-NL", { weekday: "short" })}
                </div>
                <div className="text-2xl font-semibold">{day.getDate()}</div>
              </div>
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className={`text-xs p-2 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition-all ${
                      event.status === "completed"
                        ? "border-l-emerald-500 bg-emerald-50"
                        : event.status === "in_progress"
                        ? "border-l-amber-500 bg-amber-50"
                        : "border-l-slate-400 bg-slate-50"
                    }`}
                    title={`${event.title} - ${event.description}`}
                  >
                    <div className="font-medium truncate">
                      {EVENT_ICONS[event.type]} {event.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Month View Component (Weekdays Only - Monday to Friday)
function MonthView({ events, currentDate, onEventClick }: { events: CalendarEvent[]; currentDate: Date; onEventClick: (event: CalendarEvent) => void }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Build array of weekdays only (Monday-Friday)
  const weekdays = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const day = new Date(year, month, i);
    const dayOfWeek = day.getDay();
    // Only include Monday (1) through Friday (5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      weekdays.push(day);
    }
  }

  const getEventsForDay = (day: Date) => {
    return events.filter((e) => {
      const eventDate = new Date(e.date);
      return (
        eventDate.getDate() === day.getDate() &&
        eventDate.getMonth() === day.getMonth() &&
        eventDate.getFullYear() === day.getFullYear()
      );
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm min-h-[420px]">
      <div className="grid grid-cols-5 text-xs font-medium text-slate-500 mb-2">
        <div className="text-center">Ma</div>
        <div className="text-center">Di</div>
        <div className="text-center">Wo</div>
        <div className="text-center">Do</div>
        <div className="text-center">Vr</div>
      </div>

      {/* Calendar grid - 5 columns for weekdays */}
      <div className="grid grid-cols-5 gap-2">
        {weekdays.map((day, i) => {
          const dayEvents = getEventsForDay(day);
          const isToday = day.toDateString() === new Date().toDateString();

          return (
            <div
              key={i}
              className={`rounded-xl border p-2 h-[100px] text-[10px] ${
                isToday ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50"
              }`}
            >
              <span className={`block text-slate-600 font-medium mb-1 ${isToday ? "text-blue-700" : ""}`}>
                {day.getDate()}
              </span>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map((event) => (
                  <div
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className={`text-[9px] px-1 py-0.5 rounded border-l-2 cursor-pointer hover:shadow-sm transition-all ${
                      event.status === "completed"
                        ? "border-l-emerald-500 bg-emerald-50"
                        : event.status === "in_progress"
                        ? "border-l-amber-500 bg-amber-50"
                        : "border-l-slate-400 bg-slate-100"
                    }`}
                    title={`${event.title} - ${event.description}`}
                  >
                    <div className="truncate">
                      {EVENT_ICONS[event.type]} {event.title}
                    </div>
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[9px] text-slate-500 text-center">+{dayEvents.length - 2}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Event Detail Modal Component
function EventDetailModal({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{EVENT_ICONS[event.type]}</span>
            <div>
              <h2 className="text-xl font-semibold">{event.title}</h2>
              <p className="text-sm text-gray-600">{EVENT_LABELS[event.type]}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Beschrijving</p>
            <p className="text-gray-800">{event.description || "Geen beschrijving"}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">Datum</p>
            <p className="text-gray-800">{formatDate(event.date.toISOString())}</p>
          </div>

          {event.projectName && (
            <div>
              <p className="text-sm text-gray-600 mb-1">Project</p>
              <p className="text-gray-800">{event.projectName}</p>
            </div>
          )}

          {event.courseName && (
            <div>
              <p className="text-sm text-gray-600 mb-1">Vak</p>
              <p className="text-gray-800">{event.courseName}</p>
            </div>
          )}

          {event.status && (
            <div>
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  event.status === "completed"
                    ? "bg-green-100 text-green-800"
                    : event.status === "in_progress"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {event.status === "completed" ? "✓ Afgerond" : event.status === "in_progress" ? "⏳ Bezig" : "○ Niet gestart"}
              </span>
            </div>
          )}

          {event.link && (
            <div className="pt-4 border-t">
              <Link
                href={event.link}
                className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Bekijk details →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
