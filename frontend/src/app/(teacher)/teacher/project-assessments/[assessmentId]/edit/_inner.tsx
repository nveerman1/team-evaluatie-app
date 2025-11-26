"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import {
  ProjectAssessmentDetailOut,
  ProjectAssessmentScoreCreate,
  ProjectAssessmentTeamOverview,
} from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

/**
 * Types & helpers
 */

type CriterionType = ProjectAssessmentDetailOut["criteria"][number];

type RubricLevelsRowProps = {
  criterion: CriterionType;
  scaleMin: number;
  scaleMax: number;
  value: number;
  comment: string;
  onChange: (score: number) => void;
  onCommentChange: (comment: string) => void;
  quickComments: string[];
  onAddQuickComment: (text: string) => void;
  onDeleteQuickComment: (text: string) => void;
};

/**
 * Haal beschrijving voor een bepaald level uit criterion.descriptors,
 * ongeacht de vorm van de data (array, object met keys, array van objecten, …).
 */
function getDescriptorForLevel(
  criterion: CriterionType,
  level: number,
  scaleMin: number,
): string {
  const raw: any = (criterion as any).descriptors;

  if (!raw) return "";

  // Case 1: array van strings, index op basis van schaal-min
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    const idx = level - scaleMin;
    return raw[idx] ?? "";
  }

  // Case 2: array van objecten met level + description/text
  if (Array.isArray(raw) && typeof raw[0] === "object") {
    const match = raw.find(
      (d: any) =>
        d &&
        (d.level === level ||
          d.value === level ||
          d.score === level ||
          d.index === level - scaleMin),
    );
    if (!match) return "";
    return match.description ?? match.text ?? match.label ?? "";
  }

  // Case 3: plain object: { "1": "beschrijving", "2": "..." } of { 1: "...", ... }
  if (typeof raw === "object") {
    // 3a: direct op key zoeken (1, "1")
    let v = raw[level] ?? raw[String(level)];
    if (v !== undefined) {
      if (typeof v === "string") return v;
      if (typeof v === "object") {
        return v.description ?? v.text ?? v.label ?? "";
      }
    }

    // 3b: keys sorteren en dan indexeren o.b.v. schaal-min
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

function RubricLevelsRow({
  criterion,
  scaleMin,
  scaleMax,
  value,
  comment,
  onChange,
  onCommentChange,
  quickComments,
  onAddQuickComment,
  onDeleteQuickComment,
}: RubricLevelsRowProps) {
  const levels = Array.from(
    { length: scaleMax - scaleMin + 1 },
    (_, i) => scaleMin + i,
  );

  // Local state for adding new quick comments
  const [isAddingQuick, setIsAddingQuick] = useState(false);
  const [newQuick, setNewQuick] = useState("");

  return (
    <div className="grid grid-cols-[minmax(0,3fr)_minmax(260px,2fr)] gap-4 items-stretch">
      {/* Niveaus */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-5 gap-2">
          {levels.map((level) => {
            const isSelected = value === level;
            const descriptor = getDescriptorForLevel(
              criterion,
              level,
              scaleMin,
            );

            return (
              <button
                key={level}
                type="button"
                onClick={() => onChange(level)}
                className={`group flex flex-col items-center justify-start rounded-xl border px-3 py-2 text-center text-xs transition-all hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.5)]"
                    : "border-slate-200 bg-white"
                }`}
              >
                <span
                  className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold group-hover:border-emerald-500 group-hover:text-emerald-700 ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 text-slate-700 bg-slate-50"
                  }`}
                >
                  {level}
                </span>
                {descriptor && (
                  <span className="line-clamp-3 text-[11px] leading-snug text-slate-600">
                    {descriptor}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Opmerking rechts */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-600">
            Opmerking voor student
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Optioneel
          </span>
        </div>

        {/* Quick comments chips */}
        <div className="flex flex-wrap items-center gap-2">
          {quickComments.map((qc, idx) => (
            <div key={`${qc}-${idx}`} className="group relative inline-flex">
              <button
                type="button"
                onClick={() => onCommentChange(comment ? comment + " " + qc : qc)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-700 shadow-sm hover:border-slate-300 hover:bg-white"
              >
                {qc}
              </button>
              <button
                type="button"
                className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center hover:bg-red-600 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteQuickComment(qc);
                }}
                title="Verwijder opmerking"
              >
                ×
              </button>
            </div>
          ))}
          {/* Plus button */}
          <button
            type="button"
            onClick={() => setIsAddingQuick((prev) => !prev)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-400 text-xs font-semibold text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-colors"
          >
            +
          </button>
        </div>

        {/* Add new quick comment input */}
        {isAddingQuick && (
          <div className="mt-1 flex items-center gap-2">
            <input
              type="text"
              value={newQuick}
              onChange={(e) => setNewQuick(e.target.value)}
              placeholder="Nieuwe snelle opmerking..."
              className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-200"
            />
            <button
              type="button"
              onClick={() => {
                const trimmed = newQuick.trim();
                if (!trimmed) return;
                // Prevent duplicate quick comments
                if (quickComments.includes(trimmed)) {
                  setNewQuick("");
                  setIsAddingQuick(false);
                  return;
                }
                onAddQuickComment(trimmed);
                setNewQuick("");
                setIsAddingQuick(false);
              }}
              className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
            >
              Voeg toe
            </button>
          </div>
        )}

        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Schrijf hier een korte, concrete terugkoppeling..."
          className="h-full min-h-[96px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 shadow-inner outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
        />
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Tip: benoem zowel wat goed gaat als 1 verbeterpunt.</span>
          <span>{comment.length}/400</span>
        </div>
      </div>
    </div>
  );
}

type CategoryCardProps = {
  categoryName: string;
  criteria: CriterionType[];
  scaleMin: number;
  scaleMax: number;
  scores: Record<
    number,
    {
      score: number;
      comment: string;
    }
  >;
  onScoreChange: (criterionId: number, score: number) => void;
  onCommentChange: (criterionId: number, comment: string) => void;
  quickCommentsByCriterion: Record<number, string[]>;
  onAddQuickComment: (criterionId: number, text: string) => void;
  onDeleteQuickComment: (criterionId: number, text: string) => void;
};

function CategoryCard({
  categoryName,
  criteria,
  scaleMin,
  scaleMax,
  scores,
  onScoreChange,
  onCommentChange,
  quickCommentsByCriterion,
  onAddQuickComment,
  onDeleteQuickComment,
}: CategoryCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-slate-100 bg-slate-50/80">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {categoryName || "Categorie"}
        </span>
      </header>

      <div className="divide-y divide-slate-100">
        {criteria.map((criterion, idx) => {
          const scoreEntry = scores[criterion.id] || {
            score: scaleMin,
            comment: "",
          };
          const value = scoreEntry.score;
          const comment = scoreEntry.comment;

          return (
            <div key={criterion.id}>
              {/* extra scheiding zoals in je Communication-mockup */}
              {idx > 0 && (
                <div className="h-2 bg-slate-50 border-t border-slate-100 -mx-5 mb-4" />
              )}
              <div className={`px-5 pb-4 ${idx === 0 ? "pt-4" : ""}`}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {criterion.name}
                  </h3>
                  <span className="inline-flex items-baseline gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700">Score</span>
                    <span className="text-slate-400">
                      {value} / {scaleMax}
                    </span>
                  </span>
                </div>
                <RubricLevelsRow
                  criterion={criterion}
                  scaleMin={scaleMin}
                  scaleMax={scaleMax}
                  value={value}
                  comment={comment}
                  onChange={(newScore) => onScoreChange(criterion.id, newScore)}
                  onCommentChange={(newComment) =>
                    onCommentChange(criterion.id, newComment)
                  }
                  quickComments={quickCommentsByCriterion[criterion.id] || []}
                  onAddQuickComment={(text) => onAddQuickComment(criterion.id, text)}
                  onDeleteQuickComment={(text) => onDeleteQuickComment(criterion.id, text)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Hoofdcomponent
 */

export default function EditProjectAssessmentInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentId = Number(params?.assessmentId);
  const teamNumber = searchParams.get("team")
    ? Number(searchParams.get("team"))
    : undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [data, setData] = useState<ProjectAssessmentDetailOut | null>(null);
  const [teamsData, setTeamsData] =
    useState<ProjectAssessmentTeamOverview | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [generalComment, setGeneralComment] = useState("");

  // Scores: map criterion_id -> {score, comment}
  const [scores, setScores] = useState<
    Record<number, { score: number; comment: string }>
  >({});

  // Quick comments: map criterion_id -> array of quick comment strings
  const [quickCommentsByCriterion, setQuickCommentsByCriterion] = useState<
    Record<number, string[]>
  >({});

  // Autosave timer
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load teams overview
  useEffect(() => {
    async function loadTeams() {
      try {
        const result =
          await projectAssessmentService.getTeamOverview(assessmentId);
        setTeamsData(result);
        if (
          !teamNumber &&
          result.teams.length > 0 &&
          result.teams[0].team_number
        ) {
          const firstTeam = result.teams[0].team_number;
          router.replace(
            `/teacher/project-assessments/${assessmentId}/edit?team=${firstTeam}`,
          );
        }
      } catch (e) {
        console.error("Failed to load teams", e);
      }
    }
    loadTeams();
  }, [assessmentId, teamNumber, router]);

  // Load assessment data for specific team
  useEffect(() => {
    if (teamNumber === undefined) return;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await projectAssessmentService.getProjectAssessment(
          assessmentId,
          teamNumber,
        );
        setData(result);
        setStatus(result.assessment.status as "draft" | "published");

        const scoresMap: Record<number, { score: number; comment: string }> =
          {};
        result.scores.forEach((s) => {
          scoresMap[s.criterion_id] = {
            score: s.score,
            comment: s.comment || "",
          };
        });
        setScores(scoresMap);
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
  }, [assessmentId, teamNumber]);

  // Autosave function
  const autoSaveScores = useCallback(async () => {
    if (!data || teamNumber === undefined) return;
    setAutoSaving(true);
    try {
      const scoresPayload: ProjectAssessmentScoreCreate[] = Object.entries(
        scores,
      ).map(([criterionId, d]) => ({
        criterion_id: Number(criterionId),
        score: d.score,
        comment: d.comment || undefined,
        team_number: teamNumber,
      }));

      await projectAssessmentService.batchUpdateScores(assessmentId, {
        scores: scoresPayload,
      });
    } catch (e: any) {
      console.error("Auto-save failed", e);
    } finally {
      setAutoSaving(false);
    }
  }, [scores, assessmentId, data, teamNumber]);

  // Trigger autosave when scores change
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    if (Object.keys(scores).length > 0 && teamNumber !== undefined) {
      autoSaveTimerRef.current = setTimeout(() => {
        autoSaveScores();
      }, 2000);
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [scores, autoSaveScores, teamNumber]);

  const handleSaveScores = async () => {
    if (teamNumber === undefined) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const scoresPayload: ProjectAssessmentScoreCreate[] = Object.entries(
        scores,
      ).map(([criterionId, d]) => ({
        criterion_id: Number(criterionId),
        score: d.score,
        comment: d.comment || undefined,
        team_number: teamNumber,
      }));

      await projectAssessmentService.batchUpdateScores(assessmentId, {
        scores: scoresPayload,
      });
      setSuccessMsg("Scores opgeslagen");
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

  const handlePublish = async () => {
    if (
      !confirm(
        "Weet je zeker dat je deze projectbeoordeling wilt publiceren? Studenten kunnen deze dan inzien.",
      )
    )
      return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await projectAssessmentService.updateProjectAssessment(assessmentId, {
        status: "published",
      });
      setStatus("published");
      setSuccessMsg("Projectbeoordeling gepubliceerd");
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        setError(
          e?.response?.data?.detail || e?.message || "Publiceren mislukt",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  // Navigation functions
  const navigateToTeam = (newTeamNumber: number) => {
    router.push(
      `/teacher/project-assessments/${assessmentId}/edit?team=${newTeamNumber}`,
    );
  };

  const currentTeamIndex =
    teamsData?.teams.findIndex((t) => t.team_number === teamNumber) ?? -1;
  const hasPrevTeam = currentTeamIndex > 0;
  const hasNextTeam = teamsData
    ? currentTeamIndex < teamsData.teams.length - 1
    : false;
  const prevTeamNumber =
    hasPrevTeam && teamsData
      ? teamsData.teams[currentTeamIndex - 1].team_number
      : null;
  const nextTeamNumber =
    hasNextTeam && teamsData
      ? teamsData.teams[currentTeamIndex + 1].team_number
      : null;

  const currentTeam = teamsData?.teams.find(
    (t) => t.team_number === teamNumber,
  );

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data || !currentTeam)
    return <ErrorMessage message="Geen data gevonden" />;

  const scaleMin = data.rubric_scale_min;
  const scaleMax = data.rubric_scale_max;

  // Groepeer criteria per categorie, volgorde = volgorde in data.criteria
  const categoryGroups: { name: string; criteria: CriterionType[] }[] = [];
  const categoryIndexMap: Record<string, number> = {};

  data.criteria.forEach((c) => {
    const key = c.category || "Overig";
    if (categoryIndexMap[key] === undefined) {
      categoryIndexMap[key] = categoryGroups.length;
      categoryGroups.push({ name: key, criteria: [c] });
    } else {
      categoryGroups[categoryIndexMap[key]].criteria.push(c);
    }
  });

  return (
    <>
      {/* Status and publish actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
        <div>
          <p className="text-gray-600 text-sm">
            {data.rubric_title} • Schaal: {scaleMin}-{scaleMax}
          </p>
          {autoSaving && (
            <p className="text-sm text-blue-600 mt-1">
              💾 Autosave actief...
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {status === "draft" && (
            <button
              onClick={handlePublish}
              disabled={saving}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-60"
            >
              ✅ Publiceer voor studenten
            </button>
          )}
          {status === "published" && (
            <span className="rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
              ✅ Gepubliceerd
            </span>
          )}
        </div>
      </div>

      {/* Team kaart */}
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">
            Team {teamNumber}
          </p>
          <p className="text-xs text-slate-500">
            {currentTeamIndex + 1} van {teamsData?.teams.length || 0}
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-medium">Teamleden: </span>
            {currentTeam.members.map((m) => m.name).join(", ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => prevTeamNumber && navigateToTeam(prevTeamNumber)}
            disabled={!hasPrevTeam}
            className="rounded-full border border-slate-200 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Vorig team
            </button>
            <button
              onClick={() => nextTeamNumber && navigateToTeam(nextTeamNumber)}
              disabled={!hasNextTeam}
              className="rounded-full border border-slate-200 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Volgend team →
            </button>
          </div>
        </div>

        {/* Sticky save bar – zelfde grijs als achtergrond, geen rand */}
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 bg-slate-100 px-4 sm:px-6 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              <span>
                {autoSaving
                  ? "Wijzigingen worden opgeslagen..."
                  : "Alle wijzigingen opgeslagen"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  router.push(
                    `/teacher/project-assessments/${assessmentId}/overview`,
                  )
                }
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Terug naar overzicht
              </button>
              <button
                onClick={handleSaveScores}
                disabled={saving}
                className="rounded-full bg-slate-900 px-4 py-1 text-xs font-medium text-white shadow hover:bg-black disabled:opacity-60"
              >
                Wijzigingen opslaan
              </button>
            </div>
          </div>
        </div>

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 flex items-center gap-2 border border-emerald-100">
            ✅ {successMsg}
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-100">
            {error}
          </div>
        )}

        {/* Rubric Section (zonder extra titel) */}
        <section className="space-y-5">
          <div className="flex flex-col gap-4">
            {categoryGroups.map((group) => (
              <CategoryCard
                key={group.name}
                categoryName={group.name}
                criteria={group.criteria}
                scaleMin={scaleMin}
                scaleMax={scaleMax}
                scores={scores}
                onScoreChange={(criterionId, newScore) =>
                  setScores((prev) => ({
                    ...prev,
                    [criterionId]: {
                      score: newScore,
                      comment: prev[criterionId]?.comment ?? "",
                    },
                  }))
                }
                onCommentChange={(criterionId, newComment) =>
                  setScores((prev) => ({
                    ...prev,
                    [criterionId]: {
                      score: prev[criterionId]?.score ?? scaleMin,
                      comment: newComment,
                    },
                  }))
                }
                quickCommentsByCriterion={quickCommentsByCriterion}
                onAddQuickComment={(criterionId, text) =>
                  setQuickCommentsByCriterion((prev) => ({
                    ...prev,
                    [criterionId]: [...(prev[criterionId] || []), text],
                  }))
                }
                onDeleteQuickComment={(criterionId, text) =>
                  setQuickCommentsByCriterion((prev) => ({
                    ...prev,
                    [criterionId]: (prev[criterionId] || []).filter((qc) => qc !== text),
                  }))
                }
              />
            ))}
          </div>

          {/* Algemene opmerking */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              Algemene opmerking
            </h3>
            <textarea
              className="w-full border border-slate-200 rounded-xl px-3 py-3 min-h-28 focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 text-sm bg-slate-50"
              placeholder="Algemene feedback over het project..."
              value={generalComment}
              onChange={(e) => setGeneralComment(e.target.value)}
            />
          </div>

          {/* Onderste actieknoppen */}
          <div className="flex items-center justify-between pt-4 border-t bg-white/80 rounded-2xl p-5">
            <div className="text-sm text-slate-600">
              {autoSaving ? (
                <span className="text-emerald-700">💾 Opslaan...</span>
              ) : (
                <span>✅ Alle wijzigingen opgeslagen</span>
              )}
            </div>
            <div className="flex gap-3">
              {status === "draft" && (
                <>
                  <button
                    onClick={handleSaveScores}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-black disabled:opacity-60 text-sm"
                  >
                    💾 Opslaan als concept
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 text-sm"
                  >
                    ✅ Publiceren voor studenten
                  </button>
                </>
              )}
              {status === "published" && (
                <button
                  onClick={handleSaveScores}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-black disabled:opacity-60 text-sm"
                >
                  💾 Wijzigingen opslaan
                </button>
              )}
            </div>
          </div>
        </section>
    </>
  );
}
