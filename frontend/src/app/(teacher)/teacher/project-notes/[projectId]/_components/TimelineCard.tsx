"use client";

import { useState, useEffect } from "react";
import { projectNotesService } from "@/services";
import { ProjectNote } from "@/dtos/project-notes.dto";

interface TimelineCardProps {
  contextId: number;
  searchText?: string;
  searchName?: string;
  filterCategory?: string;
}

export function TimelineCard({ 
  contextId, 
  searchText, 
  searchName, 
  filterCategory 
}: TimelineCardProps) {
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTimeline();
  }, [contextId]);

  const loadTimeline = async () => {
    try {
      setLoading(true);
      const data = await projectNotesService.getTimeline(contextId);
      setNotes(data);
    } catch (error) {
      console.error("Failed to load timeline:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter notes
  const filteredNotes = notes.filter(note => {
    if (searchText && !note.text.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }
    if (searchName) {
      const nameMatch = 
        note.student_name?.toLowerCase().includes(searchName.toLowerCase()) ||
        note.team_name?.toLowerCase().includes(searchName.toLowerCase());
      if (!nameMatch) return false;
    }
    if (filterCategory && note.omza_category !== filterCategory) {
      return false;
    }
    return true;
  });

  const getDisplayName = (note: ProjectNote) => {
    if (note.note_type === "project") return "Projectgroep";
    if (note.note_type === "team") return note.team_name || "Team";
    if (note.note_type === "student") return note.student_name || "Student";
    return "Onbekend";
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Tijdlijn</p>
          <p className="text-sm text-slate-600">
            Chronologisch overzicht van alle aantekeningen binnen dit project.
          </p>
        </div>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Laden...
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Nog geen aantekeningen in dit project.
          </div>
        ) : (
          <ol className="relative border-l border-slate-200 ml-2 pl-4 space-y-4">
            {filteredNotes.map((note) => (
              <li key={note.id} className="relative">
                <span className="absolute -left-[9px] top-[4px] h-2.5 w-2.5 rounded-full bg-indigo-500" />
                <p className="text-[11px] text-slate-500">
                  {new Date(note.created_at).toLocaleDateString('nl-NL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-800">
                    {getDisplayName(note)}
                  </span>
                  {note.omza_category && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-700">
                      {note.omza_category}
                    </span>
                  )}
                  {note.note_type === "project" && (
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-medium text-blue-700">
                      Project
                    </span>
                  )}
                  {note.note_type === "team" && (
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-medium text-green-700">
                      Team
                    </span>
                  )}
                  {note.note_type === "student" && (
                    <span className="rounded-full bg-purple-100 px-2.5 py-1 text-[10px] font-medium text-purple-700">
                      Student
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-800">{note.text}</p>
                {note.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                {(note.is_competency_evidence || note.is_portfolio_evidence) && (
                  <div className="mt-1 flex gap-1.5">
                    {note.is_competency_evidence && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                        Competentiebewijs
                      </span>
                    )}
                    {note.is_portfolio_evidence && (
                      <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
                        Portfolio-bewijs
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
