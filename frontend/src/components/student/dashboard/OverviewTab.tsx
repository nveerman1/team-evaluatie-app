import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronRight,
  ChevronDown,
  MessageSquare,
  FileText,
  TrendingUp,
} from "lucide-react";
import type {
  EvaluationResult,
  OverviewReflection,
  OverviewProjectResult,
} from "@/dtos";
import { gradesService } from "@/services";

type OverviewTabProps = {
  peerResults: EvaluationResult[];
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
  reflections = [],
  projectResults = []
}: OverviewTabProps) {
  const [expandedReflections, setExpandedReflections] = React.useState<Set<string | number>>(new Set());
  const [expandedEvaluations, setExpandedEvaluations] = React.useState<Set<string>>(new Set());
  const [enrichedEvaluations, setEnrichedEvaluations] = React.useState<EvaluationResult[]>(peerResults);

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
      <Card className="rounded-2xl border-slate-200 bg-slate-50">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-semibold text-slate-900">Overzicht</p>
              </div>
              <p className="text-sm text-slate-600">
                Jouw projectresultaten, evaluaties en reflecties.
              </p>
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

      {/* 3) Reflections - Full Width Table with Expand */}
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
