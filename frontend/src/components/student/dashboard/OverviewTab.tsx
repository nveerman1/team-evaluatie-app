import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Target,
  FileText,
  TrendingUp,
} from "lucide-react";
import { StatPill, ScoreRow, StatusBadge, OmzaTeacherBadge, OmzaTeacherStatus } from "./helpers";
import type {
  EvaluationResult,
  OverviewCompetencyProfile,
  OverviewLearningGoal,
  OverviewReflection,
  OverviewProjectResult,
  GrowthScanSummary,
} from "@/dtos";
import Link from "next/link";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { gradesService, skillTrainingService } from "@/services";
import type { StudentTrainingItem, SkillTrainingStatus } from "@/dtos";
import { STATUS_META } from "@/dtos/skill-training.dto";
import { useStudentCompetencyScans, useStudentCompetencyRadar } from "@/hooks/student/useStudentCompetencyRadar";

type OverviewTabProps = {
  peerResults: EvaluationResult[];
  scans?: GrowthScanSummary[];
  competencyProfile?: OverviewCompetencyProfile[];
  learningGoals?: OverviewLearningGoal[];
  reflections?: OverviewReflection[];
  projectResults?: OverviewProjectResult[];
};

function getScoreColor(score: number | null | undefined): string {
  if (!score) return "bg-slate-100 text-slate-400";
  if (score >= 8.0) return "bg-emerald-100 text-emerald-700";
  if (score >= 7.0) return "bg-green-100 text-green-700";
  if (score >= 6.0) return "bg-amber-100 text-amber-700";
  if (score >= 5.5) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

function formatScore(score: number | null | undefined): string {
  if (!score) return "-";
  return score.toFixed(1);
}

export function OverviewTab({ 
  peerResults,
  scans = [],
  competencyProfile = [],
  learningGoals = [],
  reflections = [],
  projectResults = []
}: OverviewTabProps) {
  const [expandedReflections, setExpandedReflections] = React.useState<Set<string | number>>(new Set());
  const [expandedEvaluations, setExpandedEvaluations] = React.useState<Set<string>>(new Set());
  const [selectedScanId, setSelectedScanId] = React.useState<string | null>(null);
  const [enrichedEvaluations, setEnrichedEvaluations] = React.useState<EvaluationResult[]>(peerResults);
  const [skillTrainings, setSkillTrainings] = React.useState<StudentTrainingItem[]>([]);

  // Fetch student's own skill trainings
  React.useEffect(() => {
    async function fetchSkillTrainings() {
      try {
        const response = await skillTrainingService.getMyTrainings();
        const visibleStatuses: SkillTrainingStatus[] = ["planned", "in_progress", "submitted", "completed", "mastered"];
        setSkillTrainings(response.items.filter((item) => visibleStatuses.includes(item.status)));
      } catch {
        // If we can't fetch trainings, leave empty
      }
    }
    fetchSkillTrainings();
  }, []);
  
  // Fetch scan list and radar data using new hooks
  const { data: scanList, isLoading: scansLoading, isError: scansError } = useStudentCompetencyScans();
  const { data: radarData, isLoading: radarLoading, isError: radarError } = useStudentCompetencyRadar(selectedScanId);

  // Initialize selected scan to the most recent one from API
  React.useEffect(() => {
    if (scanList && scanList.length > 0 && !selectedScanId) {
      setSelectedScanId(scanList[0].id);
    }
  }, [scanList, selectedScanId]);

  // Fetch grade data for evaluations to get GCF and final grade
  React.useEffect(() => {
    async function enrichEvaluationsWithGrades() {
      if (peerResults.length === 0) {
        setEnrichedEvaluations([]);
        return;
      }

      const enriched = await Promise.all(
        peerResults.map(async (evaluation) => {
          // Skip if already has complete data
          if (evaluation.gcfScore != null && evaluation.teacherGrade != null) {
            return evaluation;
          }

          // Try to fetch grade data for this evaluation
          try {
            const evaluationIdNumber = parseInt(evaluation.id.replace('ev-', ''));
            if (isNaN(evaluationIdNumber)) {
              console.warn(`Invalid evaluation ID: ${evaluation.id}`);
              return evaluation;
            }

            const gradeData = await gradesService.previewGrades(evaluationIdNumber);
            
            // Find current user's grade in the preview data (should be filtered server-side for student)
            const userGrade = gradeData.items && gradeData.items.length > 0 ? gradeData.items[0] : null;
            
            return {
              ...evaluation,
              gcfScore: userGrade?.gcf ?? evaluation.gcfScore,
              teamContributionFactor: userGrade?.gcf ?? evaluation.teamContributionFactor,
              teacherGrade: evaluation.teacherGrade, // Keep existing if already set
              teacherSuggestedGrade: userGrade?.suggested_grade ?? evaluation.teacherSuggestedGrade,
            };
          } catch (error) {
            console.warn(`Could not fetch grade data for evaluation ${evaluation.id}:`, error);
            return evaluation;
          }
        })
      );

      setEnrichedEvaluations(enriched);
    }

    enrichEvaluationsWithGrades();
  }, [peerResults]);

  // Get the latest evaluation for OMZA data summary stats
  const latestResult = React.useMemo(() => {
    if (enrichedEvaluations.length === 0) return null;
    const closedResults = enrichedEvaluations.filter((r) => r.status === "closed");
    if (closedResults.length > 0) {
      return closedResults[0];
    }
    return enrichedEvaluations[0];
  }, [enrichedEvaluations]);

  // Calculate OMZA trend data from all peer evaluations
  const omzaTrendData = React.useMemo(() => {
    if (enrichedEvaluations.length === 0) return [];
    
    const closedEvaluations = enrichedEvaluations
      .filter((r) => r.status === "closed" && r.omzaAverages && r.omzaAverages.length > 0)
      .sort((a, b) => {
        const dateA = new Date(a.deadlineISO || Date.now()).getTime();
        const dateB = new Date(b.deadlineISO || Date.now()).getTime();
        return dateA - dateB;
      });
    
    return closedEvaluations.map((evaluation) => {
      const omzaMap: Record<string, number> = {};
      evaluation.omzaAverages?.forEach(avg => {
        omzaMap[avg.label.toLowerCase()] = avg.value;
      });
      
      const date = evaluation.deadlineISO ? new Date(evaluation.deadlineISO) : new Date();
      const dateLabel = date.toLocaleDateString("nl-NL", { month: "short", day: "numeric" });
      
      return {
        date: dateLabel,
        evaluationTitle: evaluation.title,
        organiseren: omzaMap['organiseren'] || 0,
        meedoen: omzaMap['meedoen'] || 0,
        zelfvertrouwen: omzaMap['zelfvertrouwen'] || 0,
        autonomie: omzaMap['autonomie'] || 0,
      };
    });
  }, [enrichedEvaluations]);

  // Calculate OMZA average from latest
  const omzaScores = React.useMemo(() => {
    if (!latestResult) return [];
    
    if (latestResult.omzaAverages) {
      return latestResult.omzaAverages.map(avg => ({
        key: avg.key,
        label: avg.label,
        value: avg.value,
      }));
    }
    
    const keys = ["organiseren", "meedoen", "zelfvertrouwen", "autonomie"] as const;
    const labels = ["Organiseren", "Meedoen", "Zelfvertrouwen", "Autonomie"];
    
    return keys.map((key, idx) => {
      const scores = latestResult.peers?.map(p => p.scores[key]).filter(s => s != null) || [];
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        key: key.charAt(0).toUpperCase(),
        label: labels[idx],
        value: avg,
      };
    });
  }, [latestResult]);

  const omzaAverage = omzaScores.length > 0 
    ? (omzaScores.reduce((sum, s) => sum + s.value, 0) / omzaScores.length).toFixed(1)
    : "0.0";

  // Competency profile data - uses per-scan radar data when available
  const competencyProfileData = React.useMemo(() => {
    // If we have radar data for selected scan, use it
    if (radarData && radarData.categories && radarData.categories.length > 0) {
      // Include all categories to show all axes
      // For categories without scores, set to null which recharts should handle
      return radarData.categories.map(cat => ({
        category: cat.category_name,
        value: (cat.average_score !== null && cat.average_score !== undefined) ? cat.average_score : null,
      }));
    }
    
    // Fallback to aggregated competency profile
    if (!competencyProfile || competencyProfile.length === 0) {
      return [];
    }
    return competencyProfile;
  }, [radarData, competencyProfile]);

  // Filtered data with only categories that have scores (for custom rendering)
  const filteredCompetencyData = React.useMemo(() => {
    if (radarData && radarData.categories && radarData.categories.length > 0) {
      return radarData.categories
        .filter(cat => cat.average_score !== null && cat.average_score !== undefined)
        .map(cat => ({
          category: cat.category_name,
          value: cat.average_score,
        }));
    }
    return [];
  }, [radarData]);

  // Toggle reflection expansion
  const toggleReflection = (id: string | number) => {
    setExpandedReflections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Toggle evaluation expansion
  const toggleEvaluation = (id: string) => {
    setExpandedEvaluations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Overzicht</h2>
              </div>
              <p className="text-sm text-slate-600">
                Peer-feedback (OMZA), jouw leerdoelen & reflecties, je competentieprofiel en projectresultaten.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <StatPill
                icon={<MessageSquare className="h-4 w-4" />}
                label="OMZA gem."
                value={`${omzaAverage}/5`}
              />
              <StatPill
                icon={<Target className="h-4 w-4" />}
                label="Leerdoelen"
                value={`${learningGoals.length}`}
              />
              <StatPill
                icon={<FileText className="h-4 w-4" />}
                label="Reflecties"
                value={`${reflections.length}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 1) Project Results - Full Width */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Projectresultaten</CardTitle>
          <p className="text-sm text-slate-600">Overzicht van je projectbeoordelingen met scores per categorie.</p>
        </CardHeader>
        <CardContent>
          {projectResults.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Geen projectresultaten gevonden</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Opdrachtgever</th>
                    <th className="px-4 py-3">Periode</th>
                    <th className="px-4 py-3 text-center">Proces</th>
                    <th className="px-4 py-3 text-center">Eindresultaat</th>
                    <th className="px-4 py-3 text-center">Communicatie</th>
                    <th className="px-4 py-3 text-center">Eindcijfer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {projectResults.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{row.project}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.opdrachtgever || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.periode || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(row.proces)}`}>
                          {formatScore(row.proces)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(row.eindresultaat)}`}>
                          {formatScore(row.eindresultaat)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(row.communicatie)}`}>
                          {formatScore(row.communicatie)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.eindcijfer ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                            {row.eindcijfer.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2) Evaluation Heatmap - Full Width */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evaluaties Overzicht</CardTitle>
          <p className="text-sm text-slate-600">
            Overzicht van al je peerevaluaties met peer-scores en docent-feedback.
          </p>
        </CardHeader>
        <CardContent>
          {enrichedEvaluations.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Geen evaluaties gevonden</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3">Evaluatie</th>
                    <th className="px-2 py-3 text-center" title="Organiseren Peers">O Peers</th>
                    <th className="px-2 py-3 text-center" title="Meedoen Peers">M Peers</th>
                    <th className="px-2 py-3 text-center" title="Zelfvertrouwen Peers">Z Peers</th>
                    <th className="px-2 py-3 text-center" title="Autonomie Peers">A Peers</th>
                    <th className="px-2 py-3 text-center" title="Organiseren Docent">O Docent</th>
                    <th className="px-2 py-3 text-center" title="Meedoen Docent">M Docent</th>
                    <th className="px-2 py-3 text-center" title="Zelfvertrouwen Docent">Z Docent</th>
                    <th className="px-2 py-3 text-center" title="Autonomie Docent">A Docent</th>
                    <th className="px-2 py-3 text-center" title="Team-bijdrage factor">GCF</th>
                    <th className="px-2 py-3 text-center">Cijfer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {enrichedEvaluations
                    .filter((evaluation) => {
                      // Only show closed evaluations that have valid peer scores
                      if (evaluation.status !== "closed") return false;
                      
                      // Check if evaluation has peer scores data
                      if (!evaluation.omzaAverages || evaluation.omzaAverages.length === 0) return false;
                      
                      // Check if at least one OMZA score exists (not null/undefined)
                      // Note: Zero is a valid score, so we check for null/undefined specifically
                      const hasValidScores = evaluation.omzaAverages.some(avg => avg.value !== null && avg.value !== undefined);
                      return hasValidScores;
                    })
                    .map((evaluation) => {
                      // Calculate average peer scores
                      const avgScores = {
                        O: 0,
                        M: 0,
                        Z: 0,
                        A: 0,
                      };
                      
                      if (evaluation.omzaAverages && evaluation.omzaAverages.length > 0) {
                        evaluation.omzaAverages.forEach(avg => {
                          if (avg.key === 'O') avgScores.O = avg.value;
                          if (avg.key === 'M') avgScores.M = avg.value;
                          if (avg.key === 'Z') avgScores.Z = avg.value;
                          if (avg.key === 'A') avgScores.A = avg.value;
                        });
                      }

                      const getOmzaColor = (score: number | null | undefined): string => {
                        if (!score) return "bg-slate-100 text-slate-400";
                        if (score >= 4) return "bg-green-100 text-green-700";
                        if (score >= 3) return "bg-blue-100 text-blue-700";
                        return "bg-orange-100 text-orange-700";
                      };

                      const renderTeacherOmza = (score: number | undefined) => {
                        if (!score) return <span className="text-slate-300">–</span>;
                        
                        if (score === 1) {
                          return (
                            <span 
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-green-500 bg-green-100 text-[10px] font-medium text-green-700" 
                              title="Gaat goed"
                            >
                              🙂
                            </span>
                          );
                        }
                        if (score === 2) {
                          return (
                            <span 
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-green-500 bg-green-100 text-[10px] font-medium text-green-700" 
                              title="Voldoet aan verwachting"
                            >
                              ✓
                            </span>
                          );
                        }
                        if (score === 3) {
                          return (
                            <span 
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-400 bg-amber-100 text-[10px] font-medium text-amber-700" 
                              title="Let op: verbeterpunt"
                            >
                              !
                            </span>
                          );
                        }
                        if (score === 4) {
                          return (
                            <span 
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-rose-500 bg-rose-100 text-[10px] font-medium text-rose-700" 
                              title="Urgent: direct bespreken"
                            >
                              !!
                            </span>
                          );
                        }
                        return <span className="text-slate-300">–</span>;
                      };

                      const formatDate = (dateStr?: string) => {
                        if (!dateStr) return "—";
                        const date = new Date(dateStr);
                        return date.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
                      };

                      const isExpanded = expandedEvaluations.has(evaluation.id);
                      // Always allow expansion to show what content is available
                      const hasExpandableContent = true;

                      const handleRowClick = () => {
                        toggleEvaluation(evaluation.id);
                      };

                      return (
                        <React.Fragment key={evaluation.id}>
                          <tr 
                            className="hover:bg-slate-50 cursor-pointer"
                            onClick={handleRowClick}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <ChevronDown 
                                  className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                />
                                <div>
                                  <div className="font-semibold text-slate-900">{evaluation.title}</div>
                                  <div className="text-xs text-slate-600">{formatDate(evaluation.deadlineISO)}</div>
                                </div>
                              </div>
                            </td>
                            {/* Peer scores */}
                            <td className="px-2 py-3 text-center">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getOmzaColor(avgScores.O)}`}>
                                {avgScores.O ? avgScores.O.toFixed(1) : "-"}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-center">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getOmzaColor(avgScores.M)}`}>
                                {avgScores.M ? avgScores.M.toFixed(1) : "-"}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-center">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getOmzaColor(avgScores.Z)}`}>
                                {avgScores.Z ? avgScores.Z.toFixed(1) : "-"}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-center">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getOmzaColor(avgScores.A)}`}>
                                {avgScores.A ? avgScores.A.toFixed(1) : "-"}
                              </span>
                            </td>
                            {/* Teacher OMZA scores */}
                            <td className="px-2 py-3 text-center">
                              {renderTeacherOmza(evaluation.teacherOmza?.O)}
                            </td>
                            <td className="px-2 py-3 text-center">
                              {renderTeacherOmza(evaluation.teacherOmza?.M)}
                            </td>
                            <td className="px-2 py-3 text-center">
                              {renderTeacherOmza(evaluation.teacherOmza?.Z)}
                            </td>
                            <td className="px-2 py-3 text-center">
                              {renderTeacherOmza(evaluation.teacherOmza?.A)}
                            </td>
                            {/* GCF and Grade */}
                            <td className="px-2 py-3 text-center text-slate-700">
                              {evaluation.gcfScore !== null && evaluation.gcfScore !== undefined 
                                ? evaluation.gcfScore.toFixed(2) 
                                : evaluation.teamContributionFactor !== null && evaluation.teamContributionFactor !== undefined
                                ? evaluation.teamContributionFactor.toFixed(2)
                                : "—"}
                            </td>
                            <td className="px-2 py-3 text-center">
                              {evaluation.teacherGrade !== null && evaluation.teacherGrade !== undefined ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                                  {evaluation.teacherGrade.toFixed(1)}
                                </span>
                              ) : evaluation.teacherSuggestedGrade !== null && evaluation.teacherSuggestedGrade !== undefined ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                  {evaluation.teacherSuggestedGrade.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                          {/* Expandable row for AI summary and teacher comments */}
                          {isExpanded && (
                            <tr className="bg-slate-50">
                              <td colSpan={11} className="px-4 py-4">
                                <div className="space-y-3">
                                  {evaluation.aiSummary ? (
                                    <div>
                                      <h4 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4 text-indigo-600" />
                                        AI Samenvatting
                                      </h4>
                                      <p className="text-sm text-slate-700 leading-relaxed">
                                        {evaluation.aiSummary}
                                      </p>
                                    </div>
                                  ) : (
                                    <div>
                                      <h4 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4 text-slate-400" />
                                        AI Samenvatting
                                      </h4>
                                      <p className="text-sm text-slate-500 italic">
                                        Nog geen AI samenvatting beschikbaar voor deze evaluatie.
                                      </p>
                                    </div>
                                  )}
                                  {evaluation.teacherComments ? (
                                    <div>
                                      <h4 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-amber-600" />
                                        Docentopmerkingen
                                      </h4>
                                      <p className="text-sm text-slate-700 leading-relaxed">
                                        {evaluation.teacherComments}
                                      </p>
                                    </div>
                                  ) : (
                                    <div>
                                      <h4 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-slate-400" />
                                        Docentopmerkingen
                                      </h4>
                                      <p className="text-sm text-slate-500 italic">
                                        Nog geen docentopmerkingen beschikbaar voor deze evaluatie.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3) OMZA Trend (left) + Competency Profile (right) - Two Columns */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* OMZA Trend Chart */}
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">OMZA Trend</CardTitle>
            <p className="text-sm text-slate-600">Ontwikkeling van je peer-feedback scores over tijd.</p>
          </CardHeader>
          <CardContent>
            {omzaTrendData.length === 0 ? (
              <p className="text-slate-500 text-center py-4">Geen trend data beschikbaar</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={omzaTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="organiseren"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Organiseren"
                    />
                    <Line
                      type="monotone"
                      dataKey="meedoen"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Meedoen"
                    />
                    <Line
                      type="monotone"
                      dataKey="zelfvertrouwen"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      name="Zelfvertrouwen"
                    />
                    <Line
                      type="monotone"
                      dataKey="autonomie"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      name="Autonomie"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Competency Profile Radar */}
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Competentieprofiel</CardTitle>
                <p className="text-sm text-slate-600">
                  {radarData ? radarData.scan_label : "Laatste scan"} • schaal 1–5
                </p>
              </div>
              <div className="flex items-center gap-2">
                {scansError && (
                  <span className="text-xs text-amber-600" title="Kon scans niet laden">⚠</span>
                )}
                {scanList && scanList.length > 1 && (
                  <select
                    value={selectedScanId || ""}
                    onChange={(e) => setSelectedScanId(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    aria-label="Selecteer scan"
                    disabled={scansLoading}
                  >
                    {scanList.map((scan) => (
                      <option key={scan.id} value={scan.id}>
                        {scan.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {radarLoading ? (
              <div className="py-8 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
                <p className="mt-2 text-sm text-slate-600">Laden...</p>
              </div>
            ) : radarError || (scansError && !competencyProfile?.length) ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-600">
                  Fout bij het laden van competentie data.
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {selectedScanId && (
                    <Button asChild variant="default" className="rounded-xl">
                      <Link href={`/student/competency/scan/${selectedScanId}`}>
                        Bekijk deze scan <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="secondary" className="rounded-xl">
                    <Link href="/student/competency/growth">
                      Alle scans <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : competencyProfileData.length > 0 ? (
              <>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={filteredCompetencyData} outerRadius="70%">
                      <PolarGrid />
                      <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 5]} tickCount={6} tick={{ fontSize: 10 }} />
                      {/* Render actual data with only scored categories */}
                      {filteredCompetencyData.length > 0 && (
                        <Radar
                          name="Score"
                          dataKey="value"
                          stroke="#6366f1"
                          fill="rgba(99, 102, 241, 0.25)"
                          strokeWidth={2}
                          dot={{ r: 4, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
                        />
                      )}
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {selectedScanId && (
                    <Button asChild variant="default" className="rounded-xl">
                      <Link href={`/student/competency/scan/${selectedScanId}`}>
                        Bekijk deze scan <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="secondary" className="rounded-xl">
                    <Link href="/student/competency/growth">
                      Alle scans <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-600">
                  Nog geen competentiescan ingevuld. Vul eerst een scan in om je profiel te zien.
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {selectedScanId && (
                    <Button asChild variant="default" className="rounded-xl">
                      <Link href={`/student/competency/scan/${selectedScanId}`}>
                        Bekijk deze scan <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="secondary" className="rounded-xl">
                    <Link href="/student/competency/growth">
                      Alle scans <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4) Learning Goals - Full Width Table */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Leerdoelen</CardTitle>
          <p className="text-sm text-slate-600">Overzicht van al je leerdoelen en hun status.</p>
        </CardHeader>
        <CardContent>
          {learningGoals.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Geen leerdoelen ingesteld.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3">Leerdoel</th>
                    <th className="px-4 py-3">Gerelateerde competenties</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {learningGoals.map((goal) => (
                    <tr key={goal.id} className="hover:bg-slate-50">
                       <td className="px-4 py-3">
                        <div className="text-slate-900">{goal.title}</div>
                        {goal.since && <div className="text-xs text-slate-600">{goal.since}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {goal.related || "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={goal.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5) Skill Trainings - Full Width Table */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vaardigheidstrainingen</CardTitle>
          <p className="text-sm text-slate-600">Overzicht van jouw vaardigheidstrainingen en hun status.</p>
        </CardHeader>
        <CardContent>
          {skillTrainings.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Geen vaardigheidstrainingen gevonden.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3">Training</th>
                    <th className="px-4 py-3">Competentie</th>
                    <th className="px-4 py-3">Leerdoel</th>
                    <th className="px-4 py-3">Niveau</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {skillTrainings.map((item) => {
                    const meta = STATUS_META[item.status];
                    return (
                      <tr key={item.training.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-900">{item.training.title}</td>
                        <td className="px-4 py-3 text-slate-700">{item.training.competency_category_name || "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{item.training.learning_objective_title || "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{item.training.level || "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.colorClass}`}>
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6) Reflections - Full Width Table with Expand */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Reflecties</CardTitle>
          <p className="text-sm text-slate-600">Overzicht van al je reflecties. Klik om de volledige tekst te zien.</p>
        </CardHeader>
        <CardContent>
          {reflections.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Nog geen reflecties geschreven.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3">Titel</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Datum</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {reflections.map((reflection) => {
                    const isExpanded = expandedReflections.has(reflection.id);
                    return (
                      <React.Fragment key={reflection.id}>
                        <tr 
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => toggleReflection(reflection.id)}
                        >
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {reflection.title}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{reflection.type}</td>
                          <td className="px-4 py-3 text-slate-700">{reflection.date}</td>
                          <td className="px-4 py-3 text-slate-400">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50">
                            <td colSpan={4} className="px-4 py-4">
                              <div className="text-sm text-slate-700 whitespace-pre-wrap">
                                {reflection.text ? (
                                  reflection.text
                                ) : (
                                  <em className="text-slate-500">
                                    Geen reflectietekst beschikbaar
                                  </em>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
