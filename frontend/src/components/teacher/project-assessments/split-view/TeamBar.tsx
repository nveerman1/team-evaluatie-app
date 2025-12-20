'use client';

import React from 'react';

interface TeamMember {
  id: number;
  name: string;
  email: string;
}

interface TeamBarProps {
  teamNumber: number;
  teamIndex: number;
  totalTeams: number;
  members: TeamMember[];
  averageScore?: string | number;
  docOpen: boolean;
  onShowDocument?: () => void;
  onPrevTeam: () => void;
  onNextTeam: () => void;
  hasPrevTeam: boolean;
  hasNextTeam: boolean;
}

export function TeamBar({
  teamNumber,
  teamIndex,
  totalTeams,
  members,
  averageScore = '—',
  docOpen,
  onShowDocument,
  onPrevTeam,
  onNextTeam,
  hasPrevTeam,
  hasNextTeam,
}: TeamBarProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Knoppen links */}
        <div className="flex flex-wrap items-center gap-2">
          {!docOpen && onShowDocument && (
            <button
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              onClick={onShowDocument}
            >
              Toon document
            </button>
          )}
          <button
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={onPrevTeam}
            disabled={!hasPrevTeam}
          >
            ← Vorig team
          </button>
          <button
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={onNextTeam}
            disabled={!hasNextTeam}
          >
            Volgend team →
          </button>
        </div>

        {/* Tekst rechts */}
        <div className="text-right">
          <div className="text-sm font-semibold text-slate-900">Team {teamNumber}</div>
          <div className="mt-1 text-sm text-slate-500">
            {teamIndex + 1} van {totalTeams}
            <span className="mx-2 text-slate-300">•</span>
            Teamleden: <span className="text-slate-600">{members.map(m => m.name).join(', ')}</span>
            <span className="mx-2 text-slate-300">•</span>
            Gemiddelde score: <span className="text-slate-900 font-semibold">{averageScore}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
