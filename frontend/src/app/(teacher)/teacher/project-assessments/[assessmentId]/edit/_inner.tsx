"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService, submissionService } from "@/services";
import {
  ProjectAssessmentDetailOut,
  ProjectAssessmentScoreCreate,
  ProjectAssessmentTeamOverview,
} from "@/dtos";
import { SubmissionOut } from "@/dtos/submission.dto";
import { Loading, ErrorMessage } from "@/components";
import { TeamBar, DocumentPane, RubricPane } from "@/components/teacher/project-assessments/split-view";
import { useTeacherLayout } from "@/app/(teacher)/layout";

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
                  <span className="text-[11px] leading-snug text-slate-600">
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

  // Split view state
  const [docOpen, setDocOpen] = useState(false);
  const [docMode] = useState<"dock" | "overlay">("dock");
  const [docWidth, setDocWidth] = useState(0);
  const [docType, setDocType] = useState<"Verslag" | "Presentatie">("Verslag");
  const [linkHealth, setLinkHealth] = useState<"Onbekend" | "OK" | "Toegang gevraagd" | "Kapotte link">("Onbekend");
  const [docMenuOpen, setDocMenuOpen] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionOut[]>([]);
  
  // Layout context for sidebar collapse
  const { setSidebarCollapsed } = useTeacherLayout();
  
  // Focus mode = docOpen && docMode === "dock"
  const focusMode = docOpen && docMode === "dock";
  const maxDocWidth = focusMode ? 720 : 560;

  // Autosave timer
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set document panel width when opening
  useEffect(() => {
    if (docOpen && docMode === "dock" && docWidth === 0) {
      setDocWidth(Math.floor(window.innerWidth * 0.5));
    }
  }, [docOpen, docMode, docWidth]);

  // Update sidebar collapse based on focus mode
  useEffect(() => {
    setSidebarCollapsed(focusMode);
    return () => setSidebarCollapsed(false); // Cleanup
  }, [focusMode, setSidebarCollapsed]);

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

  // Load submissions for the current team
  useEffect(() => {
    if (teamNumber === undefined) return;
    
    async function loadSubmissions() {
      try {
        const data = await submissionService.getSubmissionsForAssessment(assessmentId);
        const teamSubmissions = data.items
          .filter(item => item.team_number === teamNumber)
          .map(item => item.submission);
        setSubmissions(teamSubmissions);
      } catch (err) {
        console.error('Failed to load submissions:', err);
      }
    }
    loadSubmissions();
  }, [assessmentId, teamNumber]);

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

  // Calculate average score (must be before early returns due to hooks rules)
  const averageScore = useMemo(() => {
    if (!data) return "—";
    const vals = data.criteria.map((c) => scores[c.id]?.score ?? 0).filter((n) => n > 0);
    if (!vals.length) return "—";
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return avg.toFixed(1);
  }, [data, scores]);

  // Get current document based on docType (must be before early returns due to hooks rules)
  const reportSubmission = submissions.find((s) => s.doc_type === 'report');
  const slidesSubmission = submissions.find((s) => s.doc_type === 'slides');
  const currentSubmission = docType === 'Verslag' ? reportSubmission : slidesSubmission;
  const currentDocUrl = currentSubmission?.url || null;
  const currentDocUpdatedAt = currentSubmission?.updated_at 
    ? new Date(currentSubmission.updated_at).toLocaleString('nl-NL', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—';
  const hasLink = Boolean(currentDocUrl);

  // Handler for link health change
  const handleLinkHealthChange = useCallback(async (newHealth: typeof linkHealth) => {
    setLinkHealth(newHealth);
    if (!currentSubmission) return;
    
    try {
      // Map to submission status
      let status: SubmissionOut['status'] = 'submitted';
      if (newHealth === 'OK') status = 'ok';
      else if (newHealth === 'Toegang gevraagd') status = 'access_requested';
      else if (newHealth === 'Kapotte link') status = 'broken';
      
      await submissionService.updateStatus(currentSubmission.id, { status });
      // TODO: Trigger student notification
    } catch (err) {
      console.error('Failed to update link status:', err);
    }
  }, [currentSubmission]);

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
    <div className={`p-6 transition-all duration-300 ${focusMode ? 'max-w-none' : 'max-w-6xl'} mx-auto`}>
      {/* Team Bar */}
      <TeamBar
        teamNumber={teamNumber!}
        teamIndex={currentTeamIndex}
        totalTeams={teamsData?.teams.length || 0}
        members={currentTeam.members}
        averageScore={averageScore}
        docOpen={docOpen}
        onShowDocument={() => setDocOpen(true)}
        onPrevTeam={() => prevTeamNumber && navigateToTeam(prevTeamNumber)}
        onNextTeam={() => nextTeamNumber && navigateToTeam(nextTeamNumber)}
        hasPrevTeam={hasPrevTeam}
        hasNextTeam={hasNextTeam}
      />

      {/* Sticky save bar */}
      <div className="sticky top-0 z-20 -mx-6 bg-slate-100 px-6 py-2 mt-6">
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
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 text-emerald-700 flex items-center gap-2 border border-emerald-100">
          ✅ {successMsg}
        </div>
      )}
      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 border border-red-100">
          {error}
        </div>
      )}

      {/* Split view */}
      <div 
        className="mt-6 grid gap-6" 
        style={docOpen && docMode === "dock" ? { gridTemplateColumns: `${docWidth}px 1fr` } : undefined}
      >
        {/* Document pane */}
        {docOpen && (
          <DocumentPane
            docWidth={docWidth}
            maxDocWidth={maxDocWidth}
            docType={docType}
            linkHealth={linkHealth}
            currentDocUrl={currentDocUrl}
            currentDocUpdatedAt={currentDocUpdatedAt}
            hasLink={hasLink}
            docMenuOpen={docMenuOpen}
            onDocWidthChange={setDocWidth}
            onDocTypeChange={setDocType}
            onLinkHealthChange={handleLinkHealthChange}
            onToggleDocMenu={() => setDocMenuOpen(!docMenuOpen)}
            onClose={() => {
              setDocMenuOpen(false);
              setDocOpen(false);
            }}
            onOpenInTab={() => {
              if (currentDocUrl) {
                window.open(currentDocUrl, '_blank');
              }
            }}
          />
        )}

        {/* Rubric pane */}
        <RubricPane
          teamName={`Team ${teamNumber}`}
          teamMembers={currentTeam.members.map(m => m.name).join(', ')}
          focusMode={focusMode}
        >
          {/* Rubric Section */}
          <div className="space-y-5">
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
          </div>
        </RubricPane>
      </div>
    </div>
  );
}
