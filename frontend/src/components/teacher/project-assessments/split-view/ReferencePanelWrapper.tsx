'use client';

import React from 'react';
import { DocumentPane } from './DocumentPane';
import { SelfAssessmentPane } from './SelfAssessmentPane';

export type PanelView = 'document' | 'self-assessment';

interface DocumentPaneProps {
  docWidth: number;
  maxDocWidth: number;
  docType: 'Verslag' | 'Presentatie';
  linkHealth: 'Onbekend' | 'OK' | 'Toegang gevraagd' | 'Kapotte link';
  currentDocUrl?: string | null;
  currentDocUpdatedAt?: string | null;
  hasLink: boolean;
  docMenuOpen: boolean;
  onDocWidthChange: (width: number) => void;
  onDocTypeChange: (type: 'Verslag' | 'Presentatie') => void;
  onLinkHealthChange: (health: 'Onbekend' | 'OK' | 'Toegang gevraagd' | 'Kapotte link') => void;
  onToggleDocMenu: () => void;
  onOpenInTab?: () => void;
}

interface ReferencePanelWrapperProps extends DocumentPaneProps {
  panelView: PanelView;
  onPanelViewChange: (view: PanelView) => void;
  onClose: () => void;
  assessmentId: number;
  teamNumber: number;
}

export function ReferencePanelWrapper({
  panelView,
  onPanelViewChange,
  onClose,
  assessmentId,
  teamNumber,
  ...documentPaneProps
}: ReferencePanelWrapperProps) {
  return (
    <div className="flex flex-col h-[calc(100vh-130px)]">
      {/* Top header row */}
      <div className="rounded-t-2xl border-t border-x border-slate-200 bg-white px-3 py-2 flex items-center justify-between shrink-0">
        {/* Toggle group */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {(['document', 'self-assessment'] as PanelView[]).map((view) => (
            <button
              key={view}
              onClick={() => onPanelViewChange(view)}
              className={
                'rounded-md px-2 py-1 text-xs font-medium transition ' +
                (panelView === view
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:bg-white')
              }
            >
              {view === 'document' ? '📄 Ingeleverd werk' : '📝 Zelfbeoordeling'}
            </button>
          ))}
        </div>

        {/* Close button */}
        <button
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={onClose}
        >
          Sluiten
        </button>
      </div>

      {/* Panel content */}
      {panelView === 'document' ? (
        <DocumentPane {...documentPaneProps} />
      ) : (
        <SelfAssessmentPane assessmentId={assessmentId} teamNumber={teamNumber} />
      )}
    </div>
  );
}
