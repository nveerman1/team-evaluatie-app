"use client";

import { ProjectNote } from "@/dtos/project-notes.dto";
import { ReactNode } from "react";

interface NotesOverviewAllProps {
  teamName: string;
  notes: ProjectNote[];
  filter: string | null;
  search: string;
  searchOmza: string;
}

export function NotesOverviewAll({
  teamName: _teamName,
  notes,
  filter,
  search,
  searchOmza,
}: NotesOverviewAllProps) {
  // Filter notes based on filter, search, and OMZA
  let filteredNotes = notes;
  
  // Filter by selected student or show team notes
  if (filter) {
    filteredNotes = filteredNotes.filter(
      n => n.student_name === filter || n.note_type === "team"
    );
  }
  
  // Filter by search term
  if (search) {
    const searchLower = search.toLowerCase();
    filteredNotes = filteredNotes.filter(n => 
      n.text.toLowerCase().includes(searchLower) ||
      n.student_name?.toLowerCase().includes(searchLower)
    );
  }
  
  // Filter by OMZA category
  if (searchOmza) {
    filteredNotes = filteredNotes.filter(n => n.omza_category === searchOmza);
  }

  // Sort by date descending (newest first)
  filteredNotes = [...filteredNotes].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Helper to highlight search terms safely using React elements
  const highlightText = (text: string): ReactNode => {
    if (!search) return text;
    
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearch})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (part.toLowerCase() === search.toLowerCase()) {
        return <mark key={index} className="bg-yellow-200">{part}</mark>;
      }
      return part;
    });
  };

  if (filteredNotes.length === 0) {
    return (
      <div className="pt-3 border-t border-slate-100 space-y-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Aantekeningen</p>
        <p className="text-sm text-slate-500">Nog geen aantekeningen.</p>
      </div>
    );
  }

  return (
    <div className="pt-3 border-t border-slate-100 space-y-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Aantekeningen</p>

      <div className="space-y-2 text-sm">
        {filteredNotes.map((n) => {
          const isTeam = n.note_type === "team";
          const label = isTeam ? "Team" : "Leerling";
          
          // Format date and time
          const date = new Date(n.created_at);
          const formattedDate = date.toLocaleDateString('nl-NL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          const formattedTime = date.toLocaleTimeString('nl-NL', {
            hour: '2-digit',
            minute: '2-digit',
          });

          // Get OMZA tags from metadata or from omza_category
          const omzaTagsFromMetadata = n.metadata?.omza_tags || [];
          const allOmzaTags = n.omza_category 
            ? [n.omza_category, ...omzaTagsFromMetadata.filter((t: string) => t !== n.omza_category)]
            : omzaTagsFromMetadata;

          return (
            <div
              key={n.id}
              className={`rounded-lg border p-2 ${
                isTeam ? "bg-indigo-50 border-indigo-200" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    isTeam
                      ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {label}
                </span>
                <span className="text-xs text-slate-500">
                  {formattedDate} • {formattedTime} {n.created_by_name && `• ${n.created_by_name}`}
                </span>
              </div>

              {/* Show student name for student notes */}
              {!isTeam && n.student_name && (
                <p className="text-[13px] font-semibold text-slate-900 leading-snug mb-0.5">
                  {highlightText(n.student_name)}
                </p>
              )}

              <p className="text-slate-800 text-[13px] leading-snug">
                {highlightText(n.text)}
              </p>

              {/* OMZA tags */}
              {allOmzaTags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {allOmzaTags.map((tag: string) => (
                    <span
                      key={tag}
                      className="inline-flex px-2 py-0.5 rounded-full bg-indigo-100 text-[10px] text-indigo-800"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Additional markers */}
              {(n.is_competency_evidence || n.is_portfolio_evidence) && (
                <div className="mt-1 flex gap-1.5">
                  {n.is_competency_evidence && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                      Competentiebewijs
                    </span>
                  )}
                  {n.is_portfolio_evidence && (
                    <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
                      Portfolio-bewijs
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
