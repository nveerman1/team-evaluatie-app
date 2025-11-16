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
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-7xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Kalender</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Overzicht van alle projecten, evaluaties en deadlines 📅
          </p>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Quick Actions */}
        <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">🧩 Snelle acties</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/teacher/projects/new"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-blue-700 hover:to-purple-700"
            >
              ➕ Nieuw project
            </Link>
            <Link
              href="/teacher/project-assessments/create"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              ➕ Nieuwe projectbeoordeling
            </Link>
            <Link
              href="/teacher/evaluations/create"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ➕ Nieuwe peerevaluatie
            </Link>
            <Link
              href="/teacher/competencies/windows/create"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ➕ Nieuw competentievenster
            </Link>
          </div>
        </section>

        {/* Views and Filters */}
        <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* View Mode Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("agenda")}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  viewMode === "agenda"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                📋 Agenda
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  viewMode === "week"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                📅 Week
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  viewMode === "month"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                📆 Maand
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Alle projecten</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id.toString()}>
                    {p.title}
                  </option>
                ))}
              </select>

              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Alle vakken</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id.toString()}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedEventType}
                onChange={(e) => setSelectedEventType(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Alle events</option>
                <option value="project_start">Project start</option>
                <option value="project_end">Project einde</option>
                <option value="peer_deadline_review">Peer-evaluatie deadline</option>
                <option value="peer_deadline_reflection">Reflectie deadline</option>
                <option value="competency_deadline">Competentiescan deadline</option>
              </select>
            </div>
          </div>
        </section>

        {/* Calendar Navigation */}
        {viewMode !== "agenda" && (
          <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigateDate("prev")}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                ← Vorige
              </button>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold">
                  {viewMode === "month"
                    ? currentDate.toLocaleDateString("nl-NL", { month: "long", year: "numeric" })
                    : `Week van ${currentDate.toLocaleDateString("nl-NL")}`}
                </h3>
                <button
                  onClick={goToToday}
                  className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  Vandaag
                </button>
              </div>
              <button
                onClick={() => navigateDate("next")}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                Volgende →
              </button>
            </div>
          </section>
        )}

        {/* Calendar View */}
        {viewMode === "agenda" ? (
          <AgendaView events={viewEvents} onEventClick={setSelectedEvent} />
        ) : viewMode === "week" ? (
          <WeekView events={viewEvents} currentDate={currentDate} onEventClick={setSelectedEvent} />
        ) : (
          <MonthView events={viewEvents} currentDate={currentDate} onEventClick={setSelectedEvent} />
        )}
      </main>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  );
}

// Agenda View Component
function AgendaView({ events, onEventClick }: { events: CalendarEvent[]; onEventClick: (event: CalendarEvent) => void }) {
  if (events.length === 0) {
    return (
      <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
        <p className="text-gray-500 text-center py-8">Geen aankomende events.</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            onClick={() => onEventClick(event)}
            className={`p-4 border-2 rounded-xl cursor-pointer hover:shadow-md transition-all ${
              STATUS_COLORS[event.status || "not_started"]
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{EVENT_ICONS[event.type]}</span>
                  <h3 className="font-semibold">{event.title}</h3>
                  {event.status && (
                    <span className="text-xs px-2 py-1 rounded-full bg-white/50">
                      {event.status === "completed" ? "✓ Afgerond" : event.status === "in_progress" ? "⏳ Bezig" : "○ Niet gestart"}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mb-1">{event.description}</div>
                <div className="text-xs text-gray-500">
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
    </section>
  );
}

// Week View Component
function WeekView({ events, currentDate, onEventClick }: { events: CalendarEvent[]; currentDate: Date; onEventClick: (event: CalendarEvent) => void }) {
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const days = Array.from({ length: 7 }, (_, i) => {
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
    <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const dayEvents = getEventsForDay(day);
          const isToday = day.toDateString() === new Date().toDateString();

          return (
            <div key={i} className={`border rounded-lg p-3 min-h-[150px] ${isToday ? "border-blue-500 bg-blue-50" : ""}`}>
              <div className={`text-center font-semibold mb-2 ${isToday ? "text-blue-700" : ""}`}>
                {day.toLocaleDateString("nl-NL", { weekday: "short" })}
                <div className="text-lg">{day.getDate()}</div>
              </div>
              <div className="space-y-1">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className={`text-xs p-2 rounded border-l-4 cursor-pointer hover:shadow-sm transition-all ${
                      event.status === "completed"
                        ? "border-l-green-500 bg-green-50"
                        : event.status === "in_progress"
                        ? "border-l-yellow-500 bg-yellow-50"
                        : "border-l-gray-500 bg-gray-50"
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
    </section>
  );
}

// Month View Component
function MonthView({ events, currentDate, onEventClick }: { events: CalendarEvent[]; currentDate: Date; onEventClick: (event: CalendarEvent) => void }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDay = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const days = [];
  // Add empty cells for days before month starts
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  // Add all days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
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
    <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
      <div className="grid grid-cols-7 gap-2">
        {/* Day headers */}
        {["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"].map((day) => (
          <div key={day} className="text-center font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className="border rounded-lg p-2 bg-gray-50 min-h-[100px]" />;
          }

          const dayEvents = getEventsForDay(day);
          const isToday = day.toDateString() === new Date().toDateString();

          return (
            <div key={i} className={`border rounded-lg p-2 min-h-[100px] ${isToday ? "border-blue-500 bg-blue-50" : ""}`}>
              <div className={`text-right font-semibold mb-1 ${isToday ? "text-blue-700" : ""}`}>{day.getDate()}</div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className={`text-xs p-1 rounded border-l-2 cursor-pointer hover:shadow-sm transition-all ${
                      event.status === "completed"
                        ? "border-l-green-500 bg-green-50"
                        : event.status === "in_progress"
                        ? "border-l-yellow-500 bg-yellow-50"
                        : "border-l-gray-500 bg-gray-50"
                    }`}
                    title={`${event.title} - ${event.description}`}
                  >
                    <div className="truncate">
                      {EVENT_ICONS[event.type]} {event.title}
                    </div>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 text-center">+{dayEvents.length - 3} meer</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
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
