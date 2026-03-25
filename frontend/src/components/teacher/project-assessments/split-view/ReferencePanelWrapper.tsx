"use client";

import React, { useEffect } from "react";
import { DocumentPane } from "./DocumentPane";
import { SelfAssessmentPane } from "./SelfAssessmentPane";

export type PanelView = "document" | "self-assessment";

interface DocumentPaneProps {
  docType: "Verslag" | "Presentatie";
  linkHealth: "Onbekend" | "OK" | "Toegang gevraagd" | "Kapotte link";
  currentDocUrl?: string | null;
  currentDocUpdatedAt?: string | null;
  hasLink: boolean;
  onDocTypeChange: (type: "Verslag" | "Presentatie") => void;
  onLinkHealthChange: (
    health: "Onbekend" | "OK" | "Toegang gevraagd" | "Kapotte link",
  ) => void;
  onOpenInTab?: () => void;
}

interface ReferencePanelWrapperProps extends DocumentPaneProps {
  panelView: PanelView;
  onPanelViewChange: (view: PanelView) => void;
  onClose: () => void;
  assessmentId: number;
  teamNumber: number;
  docWidth: number;
  maxDocWidth: number;
  onDocWidthChange: (width: number) => void;
}

export function ReferencePanelWrapper({
  panelView,
  onPanelViewChange,
  onClose,
  assessmentId,
  teamNumber,
  docWidth,
  maxDocWidth,
  onDocWidthChange,
  ...documentPaneProps
}: ReferencePanelWrapperProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = docWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(
        340,
        Math.min(maxDocWidth, startWidth + (e.clientX - startX)),
      );
      onDocWidthChange(newWidth);
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

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  return (
    <div className="flex h-[calc(100vh-130px)]">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top header row */}
        <div className="rounded-t-2xl border-t border-x border-slate-200 bg-white px-3 py-2 flex items-center justify-between shrink-0">
          {/* Toggle group */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(["document", "self-assessment"] as PanelView[]).map((view) => (
              <button
                key={view}
                onClick={() => onPanelViewChange(view)}
                className={
                  "rounded-md px-2 py-1 text-xs font-medium transition " +
                  (panelView === view
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:bg-white")
                }
              >
                {view === "document"
                  ? "📄 Ingeleverd werk"
                  : "📝 Zelfbeoordeling"}
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
        {panelView === "document" ? (
          <DocumentPane {...documentPaneProps} />
        ) : (
          <SelfAssessmentPane
            assessmentId={assessmentId}
            teamNumber={teamNumber}
          />
        )}
      </div>

      {/* Resize handle */}
      <div
        className="w-1 bg-slate-200 hover:bg-indigo-400 cursor-col-resize transition-colors shrink-0"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Versleep om paneel grootte aan te passen"
        tabIndex={0}
      />
    </div>
  );
}
