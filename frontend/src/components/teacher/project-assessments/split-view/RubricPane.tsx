'use client';

import React from 'react';

interface RubricPaneProps {
  children: React.ReactNode;
  teamName: string;
  teamMembers: string;
  focusMode: boolean;
}

export function RubricPane({ children, teamName, teamMembers, focusMode }: RubricPaneProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Rubric invullen</div>
          <div className="mt-1 text-sm text-slate-500">
            {teamName} • {teamMembers}
          </div>
        </div>
        {focusMode && <div className="text-xs font-medium text-slate-500">Focus nakijkmodus</div>}
      </div>

      <div className="px-6 py-5">
        {children}
      </div>
    </section>
  );
}
