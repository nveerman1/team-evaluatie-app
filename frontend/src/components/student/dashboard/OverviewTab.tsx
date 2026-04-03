import React from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown } from "lucide-react";
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

function formatScore(score: number | null | undefined): string {
  if (score == null) return "-";
  return score.toFixed(1);
}

function scoreTone(score: number | null | undefined): string {
  if (score == null) return "bg-slate-50 text-slate-400 ring-slate-200";
  if (score >= 6.5) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (score >= 5) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-red-50 text-red-700 ring-red-200";
}

function omzaTone(score: number | null | undefined): string {
  if (score == null) return "bg-slate-50 text-slate-400 ring-slate-200";
  if (score >= 4) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (score >= 3) return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function ScoreBadge({
  value,
  tone,
}: {
  value: string;
  tone: string;
}) {
  return (
    <span
      className={`inline-flex w-10 items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}
    >
      {value}
    </span>
  );
}

export function OverviewTab({
  peerResults,
  reflections = [],
  projectResults = [],
}: OverviewTabProps) {
  const [expandedReflections, setExpandedReflections] = React.useState<
    Set<string | number>
  >(new Set());
  const [expandedEvaluations, setExpandedEvaluations] = React.useState<
    Set<string>
  >(new Set());
  const [enrichedEvaluations, setEnrichedEvaluations] =
    React.useState<EvaluationResult[]>(peerResults);

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
            const evaluationIdNumber = parseInt(
              evaluation.id.replace("ev-", ""),
            );
            if (isNaN(evaluationIdNumber)) {
              console.warn(`Invalid evaluation ID: ${evaluation.id}`);
              return evaluation;
            }

            const gradeData =
              await gradesService.previewGrades(evaluationIdNumber);

            // Find current user's grade in the preview data (should be filtered server-side for student)
            const userGrade =
              gradeData.items && gradeData.items.length > 0
                ? gradeData.items[0]
                : null;

            return {
              ...evaluation,
              gcfScore: userGrade?.gcf ?? evaluation.gcfScore,
              teamContributionFactor:
                userGrade?.gcf ?? evaluation.teamContributionFactor,
              teacherGrade: evaluation.teacherGrade, // Keep existing if already set
              teacherSuggestedGrade:
                userGrade?.suggested_grade ?? evaluation.teacherSuggestedGrade,
            };
          } catch (error) {
            console.warn(
              `Could not fetch grade data for evaluation ${evaluation.id}:`,
              error,
            );
            return evaluation;
          }
        }),
      );

      setEnrichedEvaluations(enriched);
    }

    enrichEvaluationsWithGrades();
  }, [peerResults]);

  // Toggle reflection expansion
  const toggleReflection = (id: string | number) => {
    setExpandedReflections((prev) => {
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
    setExpandedEvaluations((prev) => {
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
      {/* 0) Explanation card */}
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Hoe wordt je projectcijfer bepaald?
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1.5 font-medium text-blue-800 ring-1 ring-blue-200">
            Teamresultaat 75%
          </span>
          <span className="text-slate-400">+</span>
          <span className="inline-flex items-center rounded-lg bg-violet-50 px-3 py-1.5 font-medium text-violet-800 ring-1 ring-violet-200">
            Samenwerken in het team 25%
          </span>
          <span className="text-slate-400">=</span>
          <span className="inline-flex items-center rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800 ring-1 ring-emerald-200">
            Eindcijfer project
          </span>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          <span className="font-semibold text-slate-800">Teamresultaat</span>{" "}
          telt voor 75% mee en is de beoordeling van jullie project als team.{" "}
          <span className="font-semibold text-slate-800">
            Samenwerken in het team
          </span>{" "}
          telt voor 25% mee en is jouw individuele beoordeling op plannen,
          organiseren, samenwerken, reflecteren en autonomie.
        </p>
      </div>

      {/* 1) Teamresultaat */}
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Teamresultaat</h2>
            <p className="mt-1 text-sm text-slate-600">
              Score van jullie project als team, gebaseerd op de projectrubric.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {projectResults.length === 0 ? (
            <p className="py-4 text-center text-slate-500">
              Geen projectresultaten gevonden
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-semibold">Project</th>
                  <th className="px-3 py-3 font-semibold">Opdrachtgever</th>
                  <th className="px-3 py-3 font-semibold">Periode</th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Proces
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Eindresultaat
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Communicatie
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Teamcijfer
                  </th>
                  <th className="px-3 py-3 font-semibold">Rubric</th>
                </tr>
              </thead>
              <tbody>
                {projectResults.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
                  >
                    <td className="px-3 py-4">
                      <Link
                        href={`/student/project-assessments/${row.id}`}
                        className="font-semibold text-slate-900 hover:text-blue-600 hover:underline"
                      >
                        {row.project}
                      </Link>
                    </td>
                    <td className="px-3 py-4 text-slate-600">
                      {row.opdrachtgever || "—"}
                    </td>
                    <td className="px-3 py-4 text-slate-600">
                      {row.periode || "—"}
                    </td>
                    <td className="px-3 py-4 text-center">
                      <ScoreBadge
                        value={formatScore(row.proces)}
                        tone={scoreTone(row.proces)}
                      />
                    </td>
                    <td className="px-3 py-4 text-center">
                      <ScoreBadge
                        value={formatScore(row.eindresultaat)}
                        tone={scoreTone(row.eindresultaat)}
                      />
                    </td>
                    <td className="px-3 py-4 text-center">
                      <ScoreBadge
                        value={formatScore(row.communicatie)}
                        tone={scoreTone(row.communicatie)}
                      />
                    </td>
                    <td className="px-3 py-4 text-center">
                      <ScoreBadge
                        value={formatScore(row.eindcijfer)}
                        tone={scoreTone(row.eindcijfer)}
                      />
                    </td>
                    <td className="px-3 py-4">
                      <Link
                        href={`/student/project-assessments/${row.id}`}
                        className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Bekijk rubric
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 2) Samenwerken in het team */}
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              Samenwerken in het team
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Je individuele score op OMZA binnen het team, met peerscores en
              docentfeedback.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {enrichedEvaluations.filter((e) => {
            if (e.status !== "closed") return false;
            if (!e.omzaAverages || e.omzaAverages.length === 0) return false;
            return e.omzaAverages.some(
              (avg) => avg.value !== null && avg.value !== undefined,
            );
          }).length === 0 ? (
            <p className="py-4 text-center text-slate-500">
              Geen evaluaties gevonden
            </p>
          ) : (
            <table className="min-w-full border-separate border-spacing-y-0 text-sm">
              <thead>
                <tr>
                  <th className="border-b border-slate-100 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Evaluatie
                  </th>
                  <th className="border-b border-slate-100 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Bron
                  </th>
                  <th className="border-b border-slate-100 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    O
                  </th>
                  <th className="border-b border-slate-100 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    M
                  </th>
                  <th className="border-b border-slate-100 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Z
                  </th>
                  <th className="border-b border-slate-100 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    A
                  </th>
                  <th className="border-b border-l border-slate-100 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    GCF
                  </th>
                  <th className="border-b border-slate-100 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Cijfer
                  </th>
                  <th className="border-b border-slate-100 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Opmerkingen
                  </th>
                </tr>
              </thead>
              <tbody>
                {enrichedEvaluations
                  .filter((evaluation) => {
                    if (evaluation.status !== "closed") return false;
                    if (
                      !evaluation.omzaAverages ||
                      evaluation.omzaAverages.length === 0
                    )
                      return false;
                    return evaluation.omzaAverages.some(
                      (avg) => avg.value !== null && avg.value !== undefined,
                    );
                  })
                  .map((evaluation) => {
                    const avgScores = { O: 0, M: 0, Z: 0, A: 0 };
                    if (evaluation.omzaAverages) {
                      evaluation.omzaAverages.forEach((avg) => {
                        if (avg.key === "O") avgScores.O = avg.value;
                        if (avg.key === "M") avgScores.M = avg.value;
                        if (avg.key === "Z") avgScores.Z = avg.value;
                        if (avg.key === "A") avgScores.A = avg.value;
                      });
                    }

                    const renderTeacherOmza = (
                      score: number | undefined,
                    ) => {
                      if (score == null)
                        return <span className="text-slate-300">–</span>;
                      const needsAttention = score >= 3;
                      return (
                        <div
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ring-1 ${
                            needsAttention
                              ? "bg-amber-50 text-amber-700 ring-amber-300"
                              : "bg-emerald-50 text-emerald-700 ring-emerald-300"
                          }`}
                          title={
                            score === 1
                              ? "Gaat goed"
                              : score === 2
                                ? "Voldoet aan verwachting"
                                : score === 3
                                  ? "Let op: verbeterpunt"
                                  : "Urgent: direct bespreken"
                          }
                        >
                          {needsAttention ? "!" : "✓"}
                        </div>
                      );
                    };

                    const gcfValue =
                      evaluation.gcfScore ?? evaluation.teamContributionFactor;
                    const cijfer =
                      evaluation.teacherGrade ??
                      evaluation.teacherSuggestedGrade;
                    const feedbackCount = evaluation.peers?.length ?? 0;
                    const isExpanded = expandedEvaluations.has(evaluation.id);

                    return (
                      <React.Fragment key={evaluation.id}>
                        {/* Peers row */}
                        <tr className="border-b border-slate-100 hover:bg-slate-50/40">
                          <td className="px-4 py-5 align-top" rowSpan={2}>
                            <div className="font-semibold text-[15px] text-slate-900">
                              {evaluation.title}
                            </div>
                            {feedbackCount > 0 && (
                              <div className="mt-1 text-sm text-slate-400">
                                {feedbackCount} peer-feedback reacties ontvangen
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm font-medium text-slate-500">
                            Peers
                          </td>
                          <td className="px-3 py-3 text-center">
                            <ScoreBadge
                              value={
                                avgScores.O != null && avgScores.O !== 0
                                  ? avgScores.O.toFixed(1)
                                  : "-"
                              }
                              tone={omzaTone(avgScores.O != 0 ? avgScores.O : null)}
                            />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <ScoreBadge
                              value={
                                avgScores.M != null && avgScores.M !== 0
                                  ? avgScores.M.toFixed(1)
                                  : "-"
                              }
                              tone={omzaTone(avgScores.M != 0 ? avgScores.M : null)}
                            />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <ScoreBadge
                              value={
                                avgScores.Z != null && avgScores.Z !== 0
                                  ? avgScores.Z.toFixed(1)
                                  : "-"
                              }
                              tone={omzaTone(avgScores.Z != 0 ? avgScores.Z : null)}
                            />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <ScoreBadge
                              value={
                                avgScores.A != null && avgScores.A !== 0
                                  ? avgScores.A.toFixed(1)
                                  : "-"
                              }
                              tone={omzaTone(avgScores.A != 0 ? avgScores.A : null)}
                            />
                          </td>
                          <td
                            className="border-l border-slate-100 px-3 py-3 text-center text-sm font-medium text-slate-600"
                            rowSpan={2}
                          >
                            {gcfValue != null ? gcfValue.toFixed(2) : "—"}
                          </td>
                          <td className="px-3 py-3 text-center" rowSpan={2}>
                            {cijfer != null ? (
                              <span className="inline-flex min-w-12 justify-center rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                                {cijfer.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center" rowSpan={2}>
                            <button
                              onClick={() => toggleEvaluation(evaluation.id)}
                              className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            >
                              {isExpanded
                                ? "Verberg opmerkingen"
                                : "Bekijk opmerkingen"}
                            </button>
                          </td>
                        </tr>
                        {/* Docent row */}
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <td className="px-3 py-3 text-sm font-medium text-slate-500">
                            Docent
                          </td>
                          <td className="px-3 py-3 text-center">
                            {renderTeacherOmza(evaluation.teacherOmza?.O)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {renderTeacherOmza(evaluation.teacherOmza?.M)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {renderTeacherOmza(evaluation.teacherOmza?.Z)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {renderTeacherOmza(evaluation.teacherOmza?.A)}
                          </td>
                        </tr>
                        {/* Expanded opmerkingen section */}
                        {isExpanded && (
                          <tr>
                            <td
                              colSpan={9}
                              className="border-t border-slate-100 bg-slate-50/70 px-5 py-5"
                            >
                              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200">
                                      ✦
                                    </span>
                                    <div>
                                      <h3 className="font-semibold text-slate-900">
                                        AI samenvatting
                                      </h3>
                                      <p className="text-xs text-slate-500">
                                        Korte samenvatting van de peer-feedback
                                      </p>
                                    </div>
                                  </div>
                                  {evaluation.aiSummary ? (
                                    <p className="mt-3 text-sm leading-6 text-slate-700">
                                      {evaluation.aiSummary}
                                    </p>
                                  ) : (
                                    <p className="mt-3 text-sm italic text-slate-500">
                                      Nog geen AI samenvatting beschikbaar voor
                                      deze evaluatie.
                                    </p>
                                  )}
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                                      📝
                                    </span>
                                    <div>
                                      <h3 className="font-semibold text-slate-900">
                                        Docentopmerkingen
                                      </h3>
                                      <p className="text-xs text-slate-500">
                                        Extra feedback van je docent
                                      </p>
                                    </div>
                                  </div>
                                  {evaluation.teacherComments ? (
                                    <p className="mt-3 text-sm leading-6 text-slate-700">
                                      {evaluation.teacherComments}
                                    </p>
                                  ) : (
                                    <p className="mt-3 text-sm italic text-slate-500">
                                      Nog geen docentopmerkingen beschikbaar
                                      voor deze evaluatie.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 3) Reflecties */}
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold tracking-tight">Reflecties</h2>
          <p className="mt-1 text-sm text-slate-600">
            Overzicht van al je reflecties. Klik om de volledige tekst te zien.
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          {reflections.length === 0 ? (
            <p className="py-4 text-center text-slate-500">
              Nog geen reflecties geschreven.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Titel</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Datum</th>
                  <th className="w-10 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {reflections.map((reflection) => {
                  const isExpanded = expandedReflections.has(reflection.id);
                  return (
                    <React.Fragment key={reflection.id}>
                      <tr
                        className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
                        onClick={() => toggleReflection(reflection.id)}
                      >
                        <td className="px-3 py-3 font-semibold text-slate-900">
                          {reflection.title}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {reflection.type}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {reflection.date}
                        </td>
                        <td className="px-3 py-3 text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={4} className="px-3 py-4">
                            <div className="text-sm leading-6 text-slate-700 whitespace-pre-wrap">
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
          )}
        </div>
      </div>
    </div>
  );
}
