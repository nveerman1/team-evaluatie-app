"use client";

import { useState, useEffect } from "react";
import { projectNotesService } from "@/services";
import { ProjectNote } from "@/dtos/project-notes.dto";

interface ProjectNotesCardProps {
  contextId: number;
  searchText?: string;
}

export function ProjectNotesCard({ contextId, searchText }: ProjectNotesCardProps) {
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [contextId]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const data = await projectNotesService.listNotes(contextId, {
        note_type: "project",
      });
      setNotes(data);
    } catch (error) {
      console.error("Failed to load project notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!noteText.trim()) {
      alert("Vul eerst een aantekening in.");
      return;
    }

    try {
      setSaving(true);
      await projectNotesService.createNote(contextId, {
        note_type: "project",
        text: noteText,
        tags: [],
        omza_category: null,
        learning_objective_id: null,
        is_competency_evidence: false,
        is_portfolio_evidence: false,
        metadata: {},
      });
      
      setNoteText("");
      loadNotes(); // Reload notes
    } catch (error) {
      console.error("Failed to save note:", error);
      alert("Fout bij opslaan. Probeer het opnieuw.");
    } finally {
      setSaving(false);
    }
  };

  // Filter notes based on search text
  const filteredNotes = searchText
    ? notes.filter(note => 
        note.text.toLowerCase().includes(searchText.toLowerCase())
      )
    : notes;

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Groot notitiegebied */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Projectbrede aantekeningen
            </p>
            <p className="text-sm text-slate-600">
              Interne notities voor docenten over planning, materialen en contact met opdrachtgever.
            </p>
          </div>
          <button className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] hover:bg-slate-50">
            + Markeer als highlight
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Tip: noteer praktische zaken zoals wijzigingen in planning, materiaalproblemen, afspraken met de opdrachtgever of aandachtspunten voor de volgende les.
          </div>
          <textarea
            className="mt-1 w-full min-h-[110px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
            placeholder="Bijvoorbeeld: planning loopt achter door vertraagde materiaallevering; extra coachmoment inplannen met Team 2 en afspraak met opdrachtgever verplaatsen naar volgende week..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-[11px] text-slate-500">
              Alleen zichtbaar voor docenten; niet gedeeld met leerlingen.
            </p>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Opslaan..." : "Aantekening opslaan"}
            </button>
          </div>
        </div>
      </div>

      {/* Lijst met eerdere projectnotities */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Laatste projectnotities
          </p>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Laden...
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Nog geen projectnotities. Voeg de eerste toe!
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredNotes.map((note) => (
              <li key={note.id} className="px-4 py-3.5">
                <p className="text-[11px] text-slate-500">
                  {new Date(note.created_at).toLocaleDateString('nl-NL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  {note.created_by_name && ` • ${note.created_by_name}`}
                </p>
                <p className="text-sm text-slate-800 mt-0.5">{note.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
