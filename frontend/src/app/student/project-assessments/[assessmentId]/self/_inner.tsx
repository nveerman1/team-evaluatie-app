"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { SelfAssessmentDetailOut, SelfAssessmentScoreCreate } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { studentStyles } from "@/styles/student-dashboard.styles";

type CriterionType = SelfAssessmentDetailOut["criteria"][number];

/**
 * Get description for a specific level from criterion.descriptors
 */
function getDescriptorForLevel(
  criterion: CriterionType,
  level: number,
  scaleMin: number
): string {
  const raw: any = (criterion as any).descriptors;

  if (!raw) return "";

  // Case 1: array of strings
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    const idx = level - scaleMin;
    return raw[idx] ?? "";
  }

  // Case 2: array of objects with level + description/text
  if (Array.isArray(raw) && typeof raw[0] === "object") {
    const match = raw.find(
      (d: any) =>
        d &&
        (d.level === level ||
          d.value === level ||
          d.score === level ||
          d.index === level - scaleMin)
    );
    if (!match) return "";
    return match.description ?? match.text ?? match.label ?? "";
  }

  // Case 3: plain object: { "1": "description", "2": "..." }
  if (typeof raw === "object") {
    let v = raw[level] ?? raw[String(level)];
    if (v !== undefined) {
      if (typeof v === "string") return v;
      if (typeof v === "object") {
        return v.description ?? v.text ?? v.label ?? "";
      }
    }

    // Try sorting keys and indexing
    const keys = Object.keys(raw).sort((a, b) => Number(a) - Number(b));
    const idx = level - scaleMin;
    const key = keys[idx];
    if (key !== undefined) {
      const val = raw[key];
      if (typeof val === "string") return val;
      if (typeof val === "object") {
        return val.description ?? val.text ?? val.label ?? "";
      }
    }
  }

  return "";
}

/**
 * Single rubric row for student self-assessment
 */
function SelfAssessmentRubricRow({
  criterion,
  scaleMin,
  scaleMax,
  value,
  comment,
  onChange,
  onCommentChange,
  disabled,
}: {
  criterion: CriterionType;
  scaleMin: number;
  scaleMax: number;
  value: number | null;
  comment: string;
  onChange: (score: number) => void;
  onCommentChange: (comment: string) => void;
  disabled: boolean;
}) {
  const levels = Array.from(
    { length: scaleMax - scaleMin + 1 },
    (_, i) => scaleMin + i
  );

  return (
    <div className="px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          {criterion.name}
        </h3>
        {value !== null && (
          <span className="inline-flex items-baseline gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
            <span className="font-medium text-slate-700">Score</span>
            <span className="text-slate-400">{value} / {scaleMax}</span>
          </span>
        )}
      </div>

      {/* Score levels */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
          {levels.map((level) => {
            const isSelected = value === level;
            const descriptor = getDescriptorForLevel(criterion, level, scaleMin);

            return (
              <button
                key={level}
                type="button"
                onClick={() => !disabled && onChange(level)}
                disabled={disabled}
                className={`flex flex-col items-center justify-start rounded-xl border px-3 py-2 text-center text-xs transition-all ${
                  disabled
                    ? "cursor-not-allowed opacity-60"
                    : "hover:border-emerald-500 hover:bg-emerald-50"
                } ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.5)]"
                    : "border-slate-200 bg-white"
                }`}
              >
                <span
                  className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 text-slate-700 bg-slate-50"
                  }`}
                >
                  {level}
                </span>
                {descriptor && (
                  <span className="text-[11px] leading-snug text-slate-600">
                    {descriptor}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Comment field */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-slate-600">
            Opmerking (optioneel)
          </span>
          <textarea
            value={comment}
            onChange={(e) => !disabled && onCommentChange(e.target.value)}
            disabled={disabled}
            placeholder="Licht je score toe (bijv. wat ging goed, wat kan beter)..."
            className={`min-h-[80px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 shadow-inner outline-none transition ${
              disabled
                ? "cursor-not-allowed opacity-60"
                : "focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            }`}
          />
        </div>
      </div>
    </div>
  );
}

export default function StudentSelfAssessmentInner() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = Number(params?.assessmentId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [data, setData] = useState<SelfAssessmentDetailOut | null>(null);

  // Local state for scores: Map<criterion_id, {score, comment}>
  const [scores, setScores] = useState<
    Map<number, { score: number | null; comment: string }>
  >(new Map());

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await projectAssessmentService.getSelfAssessment(
          assessmentId
        );
        setData(result);

        // Initialize scores from existing self-assessment or empty
        const initialScores = new Map<
          number,
          { score: number | null; comment: string }
        >();
        result.criteria.forEach((c) => {
          const existingScore = result.self_assessment?.scores.find(
            (s) => s.criterion_id === c.id
          );
          initialScores.set(c.id, {
            score: existingScore?.score ?? null,
            comment: existingScore?.comment ?? "",
          });
        });
        setScores(initialScores);
      } catch (e: any) {
        if (e instanceof ApiAuthError) {
          setError(e.originalMessage);
        } else {
          setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [assessmentId]);

  const handleScoreChange = (criterionId: number, score: number) => {
    setScores((prev) => {
      const newScores = new Map(prev);
      const existing = newScores.get(criterionId) || {
        score: null,
        comment: "",
      };
      newScores.set(criterionId, { ...existing, score });
      return newScores;
    });
  };

  const handleCommentChange = (criterionId: number, comment: string) => {
    setScores((prev) => {
      const newScores = new Map(prev);
      const existing = newScores.get(criterionId) || {
        score: null,
        comment: "",
      };
      newScores.set(criterionId, { ...existing, comment });
      return newScores;
    });
  };

  const handleSave = async () => {
    if (!data) return;

    // Validate that all criteria have scores
    const missingScores = data.criteria.filter((c) => {
      const scoreData = scores.get(c.id);
      return !scoreData || scoreData.score === null;
    });

    if (missingScores.length > 0) {
      setError(
        `Vul alle criteria in. Nog te vullen: ${missingScores.map((c) => c.name).join(", ")}`
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload: { scores: SelfAssessmentScoreCreate[] } = {
        scores: [],
      };

      scores.forEach((value, criterionId) => {
        if (value.score !== null) {
          payload.scores.push({
            criterion_id: criterionId,
            score: value.score,
            comment: value.comment || null,
          });
        }
      });

      await projectAssessmentService.createOrUpdateSelfAssessment(
        assessmentId,
        payload
      );
      setSuccessMsg("Zelfbeoordeling opgeslagen ✓");
      
      // Reload data to get updated timestamps
      const result = await projectAssessmentService.getSelfAssessment(
        assessmentId
      );
      setData(result);
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        setError(e?.response?.data?.detail || e?.message || "Opslaan mislukt");
      }
    } finally {
      setSaving(false);
    }
  };

  // Group criteria by category
  const groupedCriteria = useMemo(() => {
    if (!data) return {};
    const grouped: Record<string, typeof data.criteria> = {};
    data.criteria.forEach((c) => {
      const cat = c.category || "Overig";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(c);
    });
    return grouped;
  }, [data]);

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Geen data gevonden" />;

  const canEdit = data.can_edit;

  return (
    <div className={studentStyles.layout.pageContainer}>
      {/* Header */}
      <div className={studentStyles.header.container}>
        <header className={studentStyles.header.wrapper}>
          <div className={studentStyles.header.flexContainer + " mb-2"}>
            <div className={studentStyles.header.titleSection}>
              <h1 className={studentStyles.header.title}>
                Zelfbeoordeling: {data.assessment.title}
              </h1>
              <p className={studentStyles.header.subtitle}>
                Rubric: {data.rubric_title} • Beoordeel jezelf op de
                onderstaande criteria
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:self-start"
            >
              ← Terug
            </button>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className={studentStyles.layout.contentWrapper + " space-y-6"}>
        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-emerald-700">
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-rose-50 p-3 text-rose-700">
            {error}
          </div>
        )}

        {!canEdit && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm text-amber-800">
              Deze zelfbeoordeling is vergrendeld of de projectbeoordeling is
              nog niet open. Je kunt je scores bekijken maar niet meer wijzigen.
            </p>
          </div>
        )}

        {/* Rubric criteria grouped by category */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {Object.entries(groupedCriteria).map(
              ([category, categoryCriteria]) => (
                <div key={category}>
                  {/* Category header */}
                  <div className="px-6 py-3 bg-slate-100">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                      {category}
                    </h3>
                  </div>
                  {/* Criteria in this category */}
                  {categoryCriteria.map((criterion) => {
                    const scoreData = scores.get(criterion.id) || {
                      score: null,
                      comment: "",
                    };
                    return (
                      <SelfAssessmentRubricRow
                        key={criterion.id}
                        criterion={criterion}
                        scaleMin={data.rubric_scale_min}
                        scaleMax={data.rubric_scale_max}
                        value={scoreData.score}
                        comment={scoreData.comment}
                        onChange={(score) =>
                          handleScoreChange(criterion.id, score)
                        }
                        onCommentChange={(comment) =>
                          handleCommentChange(criterion.id, comment)
                        }
                        disabled={!canEdit}
                      />
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>

        {/* Save button */}
        {canEdit && (
          <div className="flex justify-center">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Opslaan…" : "Zelfbeoordeling opslaan"}
            </button>
          </div>
        )}

        {/* Info about viewing teacher assessment */}
        {data.assessment.status === "published" && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-blue-800">
              💡 Nadat je je zelfbeoordeling hebt ingevuld, kun je deze
              vergelijken met de docentbeoordeling via de knop
              "Projectbeoordeling" op het dashboard.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
