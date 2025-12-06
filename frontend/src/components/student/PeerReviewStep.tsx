"use client";

import { useState, useEffect } from "react";
import { MyAllocation, Criterion, ScoreItem } from "@/dtos";
import { studentService } from "@/services";
import { RubricRating } from "./RubricRating";

type PeerReviewStepProps = {
  peerAllocations: MyAllocation[];
  criteria: Criterion[];
  onSubmit: (allocationId: number, items: ScoreItem[]) => Promise<void>;
};

export function PeerReviewStep({
  peerAllocations,
  criteria,
  onSubmit,
}: PeerReviewStepProps) {
  const [openPanelId, setOpenPanelId] = useState<number | null>(null);

  const completedCount = peerAllocations.filter((a) => a.completed).length;
  const totalCount = peerAllocations.length;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-800">
          Beoordeel al je teamgenoten. Je moet alle peer-reviews invullen voordat je
          verder kunt.
        </p>
        <p className="text-sm text-blue-800 mt-2 font-medium">
          Voortgang: {completedCount}/{totalCount} voltooid
        </p>
      </div>

      {peerAllocations.length === 0 && (
        <div className="text-center py-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="text-lg font-medium text-yellow-900 mb-2">
              Geen teamgenoten toegewezen
            </h3>
            <p className="text-sm text-yellow-800 mb-2">
              Er zijn nog geen peer-reviews voor je klaargezet.
            </p>
            <p className="text-sm text-yellow-700">
              Neem contact op met je docent als je denkt dat dit niet klopt, of
              wacht tot de peer-reviews zijn ingesteld.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {peerAllocations.map((allocation) => (
          <PeerPanel
            key={allocation.allocation_id}
            allocation={allocation}
            criteria={criteria}
            onSubmit={onSubmit}
            isOpen={openPanelId === allocation.allocation_id}
            onToggle={() =>
              setOpenPanelId(
                openPanelId === allocation.allocation_id
                  ? null
                  : allocation.allocation_id
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

type PeerPanelProps = {
  allocation: MyAllocation;
  criteria: Criterion[];
  onSubmit: (allocationId: number, items: ScoreItem[]) => Promise<void>;
  isOpen: boolean;
  onToggle: () => void;
};

function PeerPanel({
  allocation,
  criteria,
  onSubmit,
  isOpen,
  onToggle,
}: PeerPanelProps) {
  const [values, setValues] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Initialize default values when opened
  useEffect(() => {
    if (!isOpen) return;

    const init: Record<number, number> = {};
    criteria.forEach((c) => {
      init[c.id] = 3;
    });
    setValues((prev) => ({ ...init, ...prev }));
  }, [isOpen, criteria]);

  // Prefill existing scores when opened
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    studentService
      .getScores(allocation.allocation_id)
      .then((scores) => {
        const mapV: Record<number, number> = {};
        const mapC: Record<number, string> = {};
        scores.forEach((item) => {
          mapV[item.criterion_id] = item.score;
          if (item.comment) mapC[item.criterion_id] = item.comment;
        });
        setValues((s) => ({ ...s, ...mapV }));
        setComments((s) => ({ ...s, ...mapC }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, allocation.allocation_id]);

  const allScored = criteria.every((c) => {
    const v = values[c.id] ?? 3;
    return v >= 1 && v <= 5;
  });

  const handleSubmit = async () => {
    setSending(true);
    try {
      const items: ScoreItem[] = criteria.map((c) => ({
        criterion_id: c.id,
        score: values[c.id] ?? 3,
        comment: comments[c.id] || "",
      }));
      await onSubmit(allocation.allocation_id, items);
      allocation.completed = true; // Optimistic update
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg overflow-hidden bg-slate-50 border border-slate-200 shadow-sm">
      <button
        onClick={onToggle}
        className="w-full p-4 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-medium">{allocation.reviewee_name}</span>
            {allocation.completed && (
              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                ✓ Voltooid
              </span>
            )}
          </div>
          <span className="text-gray-400">{isOpen ? "▼" : "▶"}</span>
        </div>
      </button>

      {isOpen && (
        <div className="p-4 bg-gray-50 border-t">
          {loading ? (
            <div className="text-center py-4 text-gray-500">Laden...</div>
          ) : (
            <>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-4">
                <div className="divide-y divide-slate-100">
                  {(() => {
                    // Group criteria by category
                    const grouped = criteria.reduce((acc, c) => {
                      const cat = c.category || "Overig";
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(c);
                      return acc;
                    }, {} as Record<string, Criterion[]>);

                    // OMZA category order
                    const omzaOrder = ["Organiseren", "Meedoen", "Zelfvertrouwen", "Autonomie"];
                    
                    // Sort entries by OMZA order, then alphabetically for others
                    const sortedEntries = Object.entries(grouped).sort(([catA], [catB]) => {
                      const indexA = omzaOrder.indexOf(catA);
                      const indexB = omzaOrder.indexOf(catB);
                      
                      // Both in OMZA order
                      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                      // Only A in OMZA order - A comes first
                      if (indexA !== -1) return -1;
                      // Only B in OMZA order - B comes first
                      if (indexB !== -1) return 1;
                      // Neither in OMZA order - alphabetical
                      return catA.localeCompare(catB);
                    });

                    // Render each category with its criteria
                    return sortedEntries.map(([category, categoryCriteria]) => (
                      <div key={category}>
                        {/* Category header */}
                        <div className="px-6 py-3 bg-slate-100">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{category}</h3>
                        </div>
                        {/* Criteria in this category */}
                        {categoryCriteria.map((criterion) => (
                          <RubricRating
                            key={criterion.id}
                            criterion={criterion}
                            value={values[criterion.id] ?? 3}
                            comment={comments[criterion.id] || ""}
                            onChange={(newValue) =>
                              setValues((s) => ({ ...s, [criterion.id]: newValue }))
                            }
                            onCommentChange={(newComment) =>
                              setComments((s) => ({ ...s, [criterion.id]: newComment }))
                            }
                          />
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={!allScored || sending}
                  className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                >
                  {sending ? "Bezig..." : "Opslaan"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
