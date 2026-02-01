"use client";

import { useState } from "react";
import {
  ProjectPlanSection,
  SectionMeta,
  ProjectPlanSectionStatus,
} from "@/dtos/projectplan.dto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

type StudentSectionEditorProps = {
  section: ProjectPlanSection;
  meta: SectionMeta;
  onSave: (
    sectionKey: string,
    data: {
      text?: string;
      status: ProjectPlanSectionStatus;
      client_organisation?: string;
      client_contact?: string;
      client_email?: string;
      client_phone?: string;
      client_description?: string;
    }
  ) => Promise<void>;
  isLocked: boolean;
  isUpdating?: boolean;
};

function getSectionStatusBadge(status: ProjectPlanSectionStatus) {
  switch (status) {
    case "empty":
      return (
        <Badge className="bg-slate-100 text-slate-600 border-slate-200">
          Leeg
        </Badge>
      );
    case "draft":
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
          Concept
        </Badge>
      );
    case "submitted":
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200">
          Ingediend
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
          Akkoord
        </Badge>
      );
    case "revision":
      return (
        <Badge className="bg-rose-100 text-rose-700 border-rose-200">
          Aanpassen
        </Badge>
      );
    default:
      return null;
  }
}

function getCharacterCount(
  section: ProjectPlanSection,
  localState?: {
    text?: string;
    clientOrg?: string;
    clientContact?: string;
    clientEmail?: string;
    clientPhone?: string;
    clientDesc?: string;
  }
): number {
  if (section.key === "client") {
    const parts = [
      localState?.clientOrg ?? section.client_organisation,
      localState?.clientContact ?? section.client_contact,
      localState?.clientEmail ?? section.client_email,
      localState?.clientPhone ?? section.client_phone,
      localState?.clientDesc ?? section.client_description,
    ].filter(Boolean);
    return parts.join(" ").length;
  }
  return (localState?.text ?? section.text)?.length || 0;
}

export function StudentSectionEditor({
  section,
  meta,
  onSave,
  isLocked,
  isUpdating = false,
}: StudentSectionEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localUpdating, setLocalUpdating] = useState(false);

  // Local state for editing
  const [text, setText] = useState(section.text || "");
  const [clientOrg, setClientOrg] = useState(
    section.client_organisation || ""
  );
  const [clientContact, setClientContact] = useState(
    section.client_contact || ""
  );
  const [clientEmail, setClientEmail] = useState(section.client_email || "");
  const [clientPhone, setClientPhone] = useState(section.client_phone || "");
  const [clientDesc, setClientDesc] = useState(
    section.client_description || ""
  );

  const charCount = getCharacterCount(section, {
    text,
    clientOrg,
    clientContact,
    clientEmail,
    clientPhone,
    clientDesc,
  });
  const hasFeedback = !!section.teacher_note;
  const hasContent = section.status !== "empty";

  const validateClientSection = (): boolean => {
    return !!(clientOrg.trim() && clientContact.trim() && clientEmail.trim());
  };

  const validateSection = (): boolean => {
    if (section.key === "client") {
      return validateClientSection();
    }
    // For other sections, just check if text is non-empty
    return text.trim().length > 0;
  };

  const handleSave = async (status: ProjectPlanSectionStatus) => {
    // Validate if marking as submitted
    if (status === "submitted" && !validateSection()) {
      return;
    }

    setLocalUpdating(true);
    try {
      if (section.key === "client") {
        await onSave(section.key, {
          status,
          client_organisation: clientOrg,
          client_contact: clientContact,
          client_email: clientEmail,
          client_phone: clientPhone,
          client_description: clientDesc,
        });
      } else {
        await onSave(section.key, {
          text,
          status,
        });
      }
    } finally {
      setLocalUpdating(false);
    }
  };

  const isValid = validateSection();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <h3 className="text-lg font-semibold text-slate-900">
            {meta.title}
          </h3>
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
          {isLocked && (
            <Badge className="bg-slate-100 text-slate-600 border-slate-200">
              🔒 Vergrendeld
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

          {/* Teacher Feedback (if any) */}
          {hasFeedback && (
            <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-start gap-2">
                <span className="text-lg">💬</span>
                <div>
                  <div className="text-sm font-semibold text-purple-900 mb-1">
                    Feedback van docent
                  </div>
                  <p className="text-sm text-purple-800 whitespace-pre-wrap">
                    {section.teacher_note}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Validation hint for client section */}
          {section.key === "client" && !isLocked && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-800">
                <strong>Let op:</strong> Vul minimaal organisatie,
                contactpersoon en e-mail in om deze sectie als klaar te markeren.
              </p>
            </div>
          )}

          {/* Editable Content */}
          <div className="space-y-4">
            {section.key === "client" ? (
              // Client section: grid with multiple inputs
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Organisatie *
                    </label>
                    <Input
                      value={clientOrg}
                      onChange={(e) => setClientOrg(e.target.value)}
                      placeholder="Naam van de organisatie"
                      disabled={isLocked || isUpdating || localUpdating}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Contactpersoon *
                    </label>
                    <Input
                      value={clientContact}
                      onChange={(e) => setClientContact(e.target.value)}
                      placeholder="Naam van contactpersoon"
                      disabled={isLocked || isUpdating || localUpdating}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      E-mail *
                    </label>
                    <Input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="email@voorbeeld.nl"
                      disabled={isLocked || isUpdating || localUpdating}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Telefoon
                    </label>
                    <Input
                      type="tel"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="+31 6 12345678"
                      disabled={isLocked || isUpdating || localUpdating}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Beschrijving
                  </label>
                  <Textarea
                    value={clientDesc}
                    onChange={(e) => setClientDesc(e.target.value)}
                    placeholder="Beschrijving van de organisatie en de context..."
                    className="min-h-[120px] resize-none"
                    disabled={isLocked || isUpdating || localUpdating}
                  />
                </div>
              </div>
            ) : (
              // Other sections: single textarea
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Inhoud {meta.requiredForGo && "*"}
                </label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Vul hier je ${meta.title.toLowerCase()} in...`}
                  className="min-h-[200px] resize-y"
                  disabled={isLocked || isUpdating || localUpdating}
                />
              </div>
            )}

            {/* Action Buttons */}
            {!isLocked && (
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => handleSave("draft")}
                  disabled={isUpdating || localUpdating}
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl"
                >
                  💾 Opslaan als concept
                </Button>
                <Button
                  onClick={() => handleSave("submitted")}
                  disabled={!isValid || isUpdating || localUpdating}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                  title={
                    !isValid
                      ? section.key === "client"
                        ? "Vul minimaal organisatie, contactpersoon en e-mail in"
                        : "Vul de inhoud in"
                      : ""
                  }
                >
                  ✓ Markeer als klaar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
