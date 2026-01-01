"use client";

import { useState, useEffect } from "react";
import { ProjectNote } from "@/dtos/project-notes.dto";
import { projectNotesService } from "@/services";

interface ProjectNotesPanelProps {
  projectId: number | null;
  onClose: () => void;
  width?: number;
  maxWidth?: number;
  onWidthChange?: (width: number) => void;
}

const OMZA_CATEGORIES = ["Organiseren", "Meedoen", "Zelfvertrouwen", "Autonomie"];

export function ProjectNotesPanel({
  projectId,
  onClose,
  width = 400,
  maxWidth = 600,
  onWidthChange,
}: ProjectNotesPanelProps) {
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchStudent, setSearchStudent] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterTeam, setFilterTeam] = useState<string>("");
  const [contextId, setContextId] = useState<number | null>(null);

  // Load project notes context for this project
  useEffect(() => {
    if (!projectId) {
      setNotes([]);
      setContextId(null);
      setLoading(false);
      return;
    }

    const loadContextAndNotes = async () => {
      try {
        setLoading(true);
        
        // First, find the context for this project
        // TODO: Consider adding a service method to fetch contexts by project_id 
        // directly to avoid loading all contexts when there are many
        const contexts = await projectNotesService.listContexts();
        const projectContext = contexts.find(c => c.project_id === projectId);
        
        if (projectContext) {
          setContextId(projectContext.id);
          
          // Load all notes for this context
          const allNotes = await projectNotesService.getTimeline(projectContext.id);
          setNotes(allNotes);
        } else {
          setContextId(null);
          setNotes([]);
        }
      } catch (error) {
        console.error("Failed to load project notes:", error);
        setNotes([]);
      } finally {
        setLoading(false);
      }
    };

    loadContextAndNotes();
  }, [projectId]);

  // Filter notes
  const filteredNotes = notes.filter(note => {
    const matchesStudent = !searchStudent || 
      note.student_name?.toLowerCase().includes(searchStudent.toLowerCase()) ||
      note.team_name?.toLowerCase().includes(searchStudent.toLowerCase());
    const matchesCategory = !filterCategory || note.omza_category === filterCategory;
    const matchesTeam = !filterTeam || note.team_name === filterTeam;
    return matchesStudent && matchesCategory && matchesTeam;
  });

  // Get unique team names for filter dropdown
  const uniqueTeams = Array.from(new Set(notes.map(note => note.team_name).filter(Boolean))).sort();

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.max(300, Math.min(maxWidth, startWidth + delta));
      onWidthChange?.(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  // Cleanup resize handlers on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  if (!projectId) {
    return (
      <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
          <h3 className="text-sm font-semibold text-slate-700">Projectaantekeningen</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            title="Sluiten"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-slate-500 text-center">
            Deze evaluatie is niet gekoppeld aan een project.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1 bg-slate-50 border-r border-slate-200" style={{ width }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
          <h3 className="text-sm font-semibold text-slate-700">Projectaantekeningen</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            title="Sluiten"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-slate-200 bg-white space-y-2">
          <input
            type="text"
            placeholder="Zoek leerling..."
            value={searchStudent}
            onChange={(e) => setSearchStudent(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Alle teams</option>
            {uniqueTeams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Alle categorieën</option>
            {OMZA_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <p className="text-sm text-slate-500 text-center py-4">Laden...</p>
          )}
          {!loading && !contextId && (
            <p className="text-sm text-slate-500 text-center py-4">
              Geen aantekeningen gevonden voor dit project.
            </p>
          )}
          {!loading && contextId && filteredNotes.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">
              {notes.length === 0 ? "Nog geen aantekeningen" : "Geen aantekeningen gevonden met deze filters"}
            </p>
          )}
          {!loading && filteredNotes.map((note) => (
            <div
              key={note.id}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  {note.team_name && (
                    <span className="text-xs text-slate-500 font-medium">
                      {note.team_name}
                    </span>
                  )}
                  {note.student_name && (
                    <span className="text-xs text-slate-700 font-medium ml-2">
                      {note.student_name}
                    </span>
                  )}
                </div>
                {note.omza_category && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    {note.omza_category}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.text}</p>
              <div className="mt-2 text-xs text-slate-400">
                {new Date(note.created_at).toLocaleDateString('nl-NL', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="w-1 bg-slate-200 hover:bg-indigo-400 cursor-col-resize transition-colors"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Versleep om paneel grootte aan te passen"
        tabIndex={0}
      />
    </div>
  );
}
