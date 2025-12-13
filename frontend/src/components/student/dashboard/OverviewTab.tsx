import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  MessageSquare,
  Target,
  FileText,
  TrendingUp,
} from "lucide-react";
import { StatPill, ScoreRow, StatusBadge, OmzaTeacherBadge, OmzaTeacherStatus } from "./helpers";
import { EvaluationResult } from "@/dtos";
import Link from "next/link";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";

type LearningGoal = {
  id: string;
  title: string;
  status: "actief" | "afgerond";
  since?: string;
  related?: string;
};

type Reflection = {
  id: string;
  title: string;
  type: string;
  date: string;
};

type ProjectResult = {
  id: string;
  project: string;
  meta?: string;
  opdrachtgever?: string;
  periode?: string;
  eindcijfer?: number;
  proces?: number;
  eindresultaat?: number;
  communicatie?: number;
};

type OverviewTabProps = {
  peerResults: EvaluationResult[];
  competencyData?: unknown;
  learningGoals?: LearningGoal[];
  reflections?: Reflection[];
  projectResults?: ProjectResult[];
};

export function OverviewTab({ 
  peerResults,
  competencyData,
  learningGoals = [],
  reflections = [],
  projectResults = []
}: OverviewTabProps) {
  // Calculate OMZA averages from peer results
  const omzaScores = React.useMemo(() => {
    if (peerResults.length === 0) return [];
    
    const latestResult = peerResults[0]; // Assuming sorted by date
    if (!latestResult.omzaAverages) {
      // Fallback: calculate from peers
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
    }
    
    return latestResult.omzaAverages.map(avg => ({
      key: avg.key,
      label: avg.label,
      value: avg.value,
    }));
  }, [peerResults]);

  const omzaAverage = omzaScores.length > 0 
    ? (omzaScores.reduce((sum, s) => sum + s.value, 0) / omzaScores.length).toFixed(1)
    : "0.0";

  // Get teacher OMZA and comments from latest result
  const latestResult = peerResults[0];
  const teacherOmza = latestResult?.teacherOmza;
  const teacherComment = latestResult?.teacherComments || latestResult?.teacherGradeComment;

  // Map teacher OMZA scores (1-4 scale) to status
  const mapTeacherScoreToStatus = (score?: number): OmzaTeacherStatus => {
    if (!score) return "v";
    if (score === 1) return "goed";
    if (score === 2) return "v";
    if (score === 3) return "letop";
    return "urgent";
  };

  // Competency profile data for radar chart
  const competencyProfileData = React.useMemo(() => {
    // TODO: Replace with actual competency data from API when available
    // PLACEHOLDER DATA - This should be replaced with real aggregated scan data
    // mapped to these 6 categories from the competency scan results
    return [
      { category: "Samenwerken", value: 4.2 },
      { category: "Plannen & organiseren", value: 3.7 },
      { category: "Creatief denken & problemen oplossen", value: 3.6 },
      { category: "Technische vaardigheden", value: 3.9 },
      { category: "Communicatie & presenteren", value: 3.8 },
      { category: "Reflectie & professionele houding", value: 3.4 },
    ];
  }, []);

  return (
    <div className="space-y-4">
      {/* Header block */}
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

      {/* Top grid: OMZA + Radar */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* OMZA Card */}
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Peer-feedback (OMZA)</CardTitle>
              <Button asChild variant="secondary" size="sm" className="rounded-xl">
                <Link href="/student/results">
                  Alle resultaten <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <p className="text-sm text-slate-600">
              Overzicht van je peer-feedback op Organiseren, Meedoen, Zelfvertrouwen en Autonomie.
            </p>
            {teacherOmza && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="text-xs font-semibold text-slate-500">Docent OMZA</div>
                <div className="flex items-center gap-3">
                  <OmzaTeacherBadge letter="O" status={mapTeacherScoreToStatus(teacherOmza.O)} />
                  <OmzaTeacherBadge letter="M" status={mapTeacherScoreToStatus(teacherOmza.M)} />
                  <OmzaTeacherBadge letter="Z" status={mapTeacherScoreToStatus(teacherOmza.Z)} />
                  <OmzaTeacherBadge letter="A" status={mapTeacherScoreToStatus(teacherOmza.A)} />
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {omzaScores.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {omzaScores.map((s) => (
                  <ScoreRow key={s.key} label={s.label} value={s.value} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Nog geen peer-feedback beschikbaar.</p>
            )}

            {latestResult?.aiSummary && (
              <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
                {latestResult.aiSummary}
              </div>
            )}

            {teacherComment && (
              <div className="rounded-xl border bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">Opmerkingen van de docent</div>
                  <Badge className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">Docent</Badge>
                </div>
                <div className="text-sm text-slate-700">{teacherComment}</div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" className="rounded-xl">
                <Link href="/student/results">
                  Bekijk peer-feedback <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Competency Profile Radar */}
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Competentieprofiel</CardTitle>
            <p className="text-sm text-slate-600">
              Laatste scan • schaal 1–5
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={competencyProfileData} outerRadius="80%">
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tickCount={6} />
                  <Radar
                    name="Score"
                    dataKey="value"
                    stroke="#6366f1"
                    fill="rgba(99, 102, 241, 0.25)"
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button asChild variant="secondary" className="rounded-xl">
                <Link href="/student/competency/growth">
                  Bekijk scans <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Learning Goals + Reflections */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leerdoelen</CardTitle>
            <p className="text-sm text-slate-600">Zie je actieve leerdoelen en wat je al hebt afgerond.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {learningGoals.length > 0 ? (
              <>
                {learningGoals.slice(0, 3).map((goal) => (
                  <div key={goal.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{goal.title}</div>
                      <div className="text-xs text-slate-600">
                        {goal.since && `Sinds ${goal.since}`}
                        {goal.related && ` • ${goal.related}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={goal.status} />
                      <Button size="sm" variant="secondary" className="rounded-xl">
                        Open <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button asChild variant="secondary" className="rounded-xl">
                    <Link href="/student/competency/growth">
                      Alle leerdoelen <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-600">Nog geen leerdoelen ingesteld.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Reflecties</CardTitle>
            <p className="text-sm text-slate-600">Snel naar je reflecties.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {reflections.length > 0 ? (
              <>
                {reflections.slice(0, 3).map((r) => (
                  <button
                    key={r.id}
                    className="w-full rounded-xl border p-3 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{r.title}</div>
                        <div className="text-xs text-slate-600">{r.type} • {r.date}</div>
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 text-slate-400" />
                    </div>
                  </button>
                ))}
                <Button asChild variant="secondary" className="w-full rounded-xl">
                  <Link href="/student/competency/growth">
                    Alle reflecties <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-slate-600">Nog geen reflecties geschreven.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Project Results Table */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base">Alle projectbeoordelingen</CardTitle>
              <p className="text-sm text-slate-600">Vergelijk je projecten en open details per beoordeling.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" className="rounded-xl">
                Sorteren op nieuwste
              </Button>
              <Button variant="secondary" size="sm" className="rounded-xl">
                Exporteren als PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {projectResults.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Opdrachtgever</th>
                    <th className="px-4 py-3">Periode</th>
                    <th className="px-4 py-3">Eindcijfer</th>
                    <th className="px-4 py-3">Proces</th>
                    <th className="px-4 py-3">Eindresultaat</th>
                    <th className="px-4 py-3">Communicatie</th>
                    <th className="px-4 py-3 text-right">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {projectResults.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{row.project}</div>
                        <div className="text-xs text-slate-600">{row.meta}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.opdrachtgever || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.periode || "—"}</td>
                      <td className="px-4 py-3">
                        {row.eindcijfer && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                            {row.eindcijfer.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.proces ? `${row.proces.toFixed(1)} / 5` : "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.eindresultaat ? `${row.eindresultaat.toFixed(1)} / 5` : "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.communicatie ? `${row.communicatie.toFixed(1)} / 5` : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" className="rounded-xl bg-slate-900 hover:bg-slate-800">
                          Bekijk details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-slate-600">
              Nog geen projectresultaten beschikbaar. Deze verschijnen zodra projecten zijn beoordeeld.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
