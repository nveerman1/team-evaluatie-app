"use client";

import { useState } from "react";
import { ProjectPlanSection, SectionMeta, ProjectPlanSectionStatus } from "@/dtos/projectplan.dto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type SectionAccordionProps = {
  section: ProjectPlanSection;
  meta: SectionMeta;
  onUpdateFeedback: (sectionKey: string, feedback: string, status: "approved" | "revision") => Promise<void>;
  isUpdating?: boolean;
};

function getSectionStatusBadge(status: ProjectPlanSectionStatus) {
  switch (status) {
    case "empty":
      return <Badge className="bg-slate-100 text-slate-600 border-slate-200">Leeg</Badge>;
    case "draft":
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Concept</Badge>;
    case "submitted":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Ingediend</Badge>;
    case "approved":
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Akkoord</Badge>;
    case "revision":
      return <Badge className="bg-rose-100 text-rose-700 border-rose-200">Aanpassen</Badge>;
    default:
      return null;
  }
}

function getCharacterCount(section: ProjectPlanSection): number {
  if (section.key === "client") {
    const parts = [
      section.client_organisation,
      section.client_contact,
      section.client_email,
      section.client_phone,
      section.client_description,
    ].filter(Boolean);
    return parts.join(" ").length;
  }
  return section.text?.length || 0;
}

export function SectionAccordion({
  section,
  meta,
  onUpdateFeedback,
  isUpdating = false,
}: SectionAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedback, setFeedback] = useState(section.teacher_note || "");
  const [localUpdating, setLocalUpdating] = useState(false);

  const charCount = getCharacterCount(section);
  const hasFeedback = !!section.teacher_note;
  const hasContent = section.status !== "empty";

  const handleSubmitFeedback = async (status: "approved" | "revision") => {
    setLocalUpdating(true);
    try {
      await onUpdateFeedback(section.key, feedback, status);
    } finally {
      setLocalUpdating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <h3 className="text-lg font-semibold text-slate-900">{meta.title}</h3>
          {meta.requiredForGo && (
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
              Verplicht
            </Badge>
          )}
          {getSectionStatusBadge(section.status)}
          {hasFeedback && (
            <Badge className="bg-purple-100 text-purple-700 border-purple-200">
              💬 Feedback
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{charCount} tekens</span>
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-200 p-6 bg-slate-50/50">
          {/* Hint */}
          <p className="text-sm text-slate-600 mb-4 italic">{meta.hint}</p>

          {!hasContent && (
            <div className="text-sm text-slate-400 italic mb-4">
              Deze sectie is nog niet ingevuld door studenten.
            </div>
          )}

          {hasContent && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* LEFT: Teacher Feedback */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Docent feedback
                  </label>
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Geef hier je feedback..."
                    className="min-h-[120px] resize-none"
                    disabled={isUpdating || localUpdating}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSubmitFeedback("approved")}
                    disabled={isUpdating || localUpdating}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    ✓ Akkoord
                  </Button>
                  <Button
                    onClick={() => handleSubmitFeedback("revision")}
                    disabled={!feedback.trim() || isUpdating || localUpdating}
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    ✗ Aanpassen
                  </Button>
                </div>
              </div>

              {/* RIGHT: Student Content (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Student inhoud
                </label>
                <div className="rounded-xl border border-slate-300 bg-white p-4 min-h-[120px] text-sm text-slate-700">
                  {section.key === "client" ? (
                    <div className="space-y-2">
                      {section.client_organisation && (
                        <div>
                          <span className="font-semibold">Organisatie:</span>{" "}
                          {section.client_organisation}
                        </div>
                      )}
                      {section.client_contact && (
                        <div>
                          <span className="font-semibold">Contactpersoon:</span>{" "}
                          {section.client_contact}
                        </div>
                      )}
                      {section.client_email && (
                        <div>
                          <span className="font-semibold">E-mail:</span>{" "}
                          {section.client_email}
                        </div>
                      )}
                      {section.client_phone && (
                        <div>
                          <span className="font-semibold">Telefoon:</span>{" "}
                          {section.client_phone}
                        </div>
                      )}
                      {section.client_description && (
                        <div className="mt-3">
                          <span className="font-semibold">Beschrijving:</span>
                          <p className="mt-1 whitespace-pre-wrap">{section.client_description}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">
                      {section.text || (
                        <span className="text-slate-400 italic">Geen tekst</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
