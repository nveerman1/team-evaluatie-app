import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, TrendingUp } from "lucide-react";
import { StatusBadge } from "./helpers";
import type {
  EvaluationResult,
  OverviewCompetencyProfile,
  OverviewLearningGoal,
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
import {
  useStudentCompetencyScans,
  useStudentCompetencyRadar,
} from "@/hooks/student/useStudentCompetencyRadar";

type VoortgangTabProps = {
  peerResults: EvaluationResult[];
  competencyProfile?: OverviewCompetencyProfile[];
  learningGoals?: OverviewLearningGoal[];
};

export function VoortgangTab({
  peerResults,
  competencyProfile = [],
  learningGoals = [],
}: VoortgangTabProps) {
  const [selectedScanId, setSelectedScanId] = React.useState<string | null>(
    null,
  );
  const [enrichedEvaluations, setEnrichedEvaluations] =
    React.useState<EvaluationResult[]>(peerResults);
  const [skillTrainings, setSkillTrainings] = React.useState<
    StudentTrainingItem[]
  >([]);

  // Fetch student's own skill trainings
  React.useEffect(() => {
    async function fetchSkillTrainings() {
      try {
        const response = await skillTrainingService.getMyTrainings();
        const visibleStatuses: SkillTrainingStatus[] = [
          "planned",
          "in_progress",
          "submitted",
          "completed",
          "mastered",
        ];
        setSkillTrainings(
          response.items.filter((item) =>
            visibleStatuses.includes(item.status),
          ),
        );
      } catch {
        // If we can't fetch trainings, leave empty
      }
    }
    fetchSkillTrainings();
  }, []);

  // Fetch scan list and radar data using hooks
  const {
    data: scanList,
    isLoading: scansLoading,
    isError: scansError,
  } = useStudentCompetencyScans();
  const {
    data: radarData,
    isLoading: radarLoading,
    isError: radarError,
  } = useStudentCompetencyRadar(selectedScanId);

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
          if (evaluation.gcfScore != null && evaluation.teacherGrade != null) {
            return evaluation;
          }

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
            const userGrade =
              gradeData.items && gradeData.items.length > 0
                ? gradeData.items[0]
                : null;

            return {
              ...evaluation,
              gcfScore: userGrade?.gcf ?? evaluation.gcfScore,
              teamContributionFactor:
                userGrade?.gcf ?? evaluation.teamContributionFactor,
              teacherGrade: evaluation.teacherGrade,
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

  // Calculate OMZA trend data from all peer evaluations
  const omzaTrendData = React.useMemo(() => {
    if (enrichedEvaluations.length === 0) return [];

    const closedEvaluations = enrichedEvaluations
      .filter(
        (r) =>
          r.status === "closed" && r.omzaAverages && r.omzaAverages.length > 0,
      )
      .sort((a, b) => {
        const dateA = new Date(a.deadlineISO || Date.now()).getTime();
        const dateB = new Date(b.deadlineISO || Date.now()).getTime();
        return dateA - dateB;
      });

    return closedEvaluations.map((evaluation) => {
      const omzaMap: Record<string, number> = {};
      evaluation.omzaAverages?.forEach((avg) => {
        omzaMap[avg.label.toLowerCase()] = avg.value;
      });

      const date = evaluation.deadlineISO
        ? new Date(evaluation.deadlineISO)
        : new Date();
      const dateLabel = date.toLocaleDateString("nl-NL", {
        month: "short",
        day: "numeric",
      });

      return {
        date: dateLabel,
        evaluationTitle: evaluation.title,
        organiseren: omzaMap["organiseren"] || 0,
        meedoen: omzaMap["meedoen"] || 0,
        zelfvertrouwen: omzaMap["zelfvertrouwen"] || 0,
        autonomie: omzaMap["autonomie"] || 0,
      };
    });
  }, [enrichedEvaluations]);

  // Competency profile data - uses per-scan radar data when available
  const competencyProfileData = React.useMemo(() => {
    if (radarData && radarData.categories && radarData.categories.length > 0) {
      return radarData.categories.map((cat) => ({
        category: cat.category_name,
        value:
          cat.average_score !== null && cat.average_score !== undefined
            ? cat.average_score
            : null,
      }));
    }

    if (!competencyProfile || competencyProfile.length === 0) {
      return [];
    }
    return competencyProfile;
  }, [radarData, competencyProfile]);

  // Filtered data with only categories that have scores (for custom rendering)
  const filteredCompetencyData = React.useMemo(() => {
    if (radarData && radarData.categories && radarData.categories.length > 0) {
      return radarData.categories
        .filter(
          (cat) =>
            cat.average_score !== null && cat.average_score !== undefined,
        )
        .map((cat) => ({
          category: cat.category_name,
          value: cat.average_score,
        }));
    }
    return [];
  }, [radarData]);

  return (
    <div className="space-y-4">
      {/* Row 1: OMZA Trend (left) + Competency Profile (right) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* OMZA Trend Chart */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="p-5 pb-3">
            <h2 className="text-lg font-semibold text-slate-900">OMZA Trend</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ontwikkeling van je peer-feedback scores over tijd.
            </p>
          </div>
          <div className="px-5 pb-5">
            {omzaTrendData.length === 0 ? (
              <p className="text-slate-500 text-center py-4">
                Geen trend data beschikbaar
              </p>
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
          </div>
        </div>

        {/* Competency Profile Radar */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="p-5 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Competentieprofiel
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {radarData ? radarData.scan_label : "Laatste scan"} • schaal
                  1–5
                </p>
              </div>
              <div className="flex items-center gap-2">
                {scansError && (
                  <span
                    className="text-xs text-amber-600"
                    title="Kon scans niet laden"
                  >
                    ⚠
                  </span>
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
          </div>
          <div className="px-5 pb-5">
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
                      <Link
                        href={`/student/competency/scan/${encodeURIComponent(selectedScanId)}`}
                      >
                        Bekijk deze scan{" "}
                        <ChevronRight className="ml-1 h-4 w-4" />
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
                      <PolarAngleAxis
                        dataKey="category"
                        tick={{ fontSize: 11 }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 5]}
                        tickCount={6}
                        tick={{ fontSize: 10 }}
                      />
                      {filteredCompetencyData.length > 0 && (
                        <Radar
                          name="Score"
                          dataKey="value"
                          stroke="#6366f1"
                          fill="rgba(99, 102, 241, 0.25)"
                          strokeWidth={2}
                          dot={{
                            r: 4,
                            fill: "#6366f1",
                            strokeWidth: 2,
                            stroke: "#fff",
                          }}
                        />
                      )}
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {selectedScanId && (
                    <Button asChild variant="default" className="rounded-xl">
                      <Link
                        href={`/student/competency/scan/${encodeURIComponent(selectedScanId)}`}
                      >
                        Bekijk deze scan{" "}
                        <ChevronRight className="ml-1 h-4 w-4" />
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
                  Nog geen competentiescan ingevuld. Vul eerst een scan in om je
                  profiel te zien.
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {selectedScanId && (
                    <Button asChild variant="default" className="rounded-xl">
                      <Link
                        href={`/student/competency/scan/${encodeURIComponent(selectedScanId)}`}
                      >
                        Bekijk deze scan{" "}
                        <ChevronRight className="ml-1 h-4 w-4" />
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
          </div>
        </div>
      </div>

      {/* Row 2: Leerdoelen */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 pb-3">
          <h2 className="text-lg font-semibold text-slate-900">Leerdoelen</h2>
          <p className="mt-1 text-sm text-slate-500">
            Overzicht van al je leerdoelen en hun status.
          </p>
        </div>
        <div className="px-5 pb-5">
          {learningGoals.length === 0 ? (
            <p className="text-slate-500 text-center py-4">
              Geen leerdoelen ingesteld.
            </p>
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
                        {goal.since && (
                          <div className="text-xs text-slate-600">
                            {goal.since}
                          </div>
                        )}
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
        </div>
      </div>

      {/* Row 3: Vaardigheidstrainingen */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 pb-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Vaardigheidstrainingen
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Overzicht van jouw vaardigheidstrainingen en hun status.
          </p>
        </div>
        <div className="px-5 pb-5">
          {skillTrainings.length === 0 ? (
            <p className="text-slate-500 text-center py-4">
              Geen vaardigheidstrainingen gevonden.
            </p>
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
                        <td className="px-4 py-3 text-slate-900">
                          {item.training.title}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.training.competency_category_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.training.learning_objective_title || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.training.level || "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.colorClass}`}
                          >
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
        </div>
      </div>
    </div>
  );
}
