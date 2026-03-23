"use client";

import { useState, useEffect } from "react";
import { projectFeedbackService } from "@/services";
import type { ProjectFeedbackRound } from "@/dtos/project-feedback.dto";
import { Loading, ErrorMessage } from "@/components";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, ChevronRight } from "lucide-react";
import Link from "next/link";

export function ProjectFeedbackDashboardTab() {
  const [rounds, setRounds] = useState<ProjectFeedbackRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittedIds, setSubmittedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const data = await projectFeedbackService.listStudentRounds();
        setRounds(data);

        const checked = await Promise.all(
          data.map(async (r) => {
            try {
              const resp = await projectFeedbackService.getMyResponse(r.id);
              return resp.submitted_at ? r.id : null;
            } catch {
              return null;
            }
          })
        );
        setSubmittedIds(new Set(checked.filter(Boolean) as number[]));
      } catch (e: any) {
        setError(e?.message || "Laden mislukt");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-4">
      {/* Intro card — matches projecten tab style */}
      <Card className="rounded-2xl border-slate-200 bg-slate-50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-slate-600" />
            <p className="text-sm font-semibold text-slate-900">Mijn projectfeedback</p>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Geef feedback over de projecten waarbij jij betrokken was.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {rounds.length === 0 ? (
          <div className="p-8 rounded-xl shadow-sm bg-slate-50 text-center">
            <p className="text-slate-500">
              Er zijn momenteel geen openstaande feedbackvragenlijsten voor jou.
            </p>
          </div>
        ) : (
          rounds.map((round) => {
            const done = submittedIds.has(round.id);
            return (
              <Card
                key={round.id}
                className="rounded-2xl border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">
                          {round.title}
                        </h3>
                        {done ? (
                          <Badge className="rounded-full bg-green-100 text-green-700 border-green-200 border hover:bg-green-100">
                            ✓ Ingevuld
                          </Badge>
                        ) : (
                          <Badge className="rounded-full bg-blue-100 text-blue-700 border-blue-200 border hover:bg-blue-100">
                            Open
                          </Badge>
                        )}
                      </div>
                      {round.course_name && (
                        <div className="text-sm text-slate-600">
                          Vak: {round.course_name}
                        </div>
                      )}
                      <div className="text-sm text-slate-600">
                        {round.question_count} vragen
                      </div>
                    </div>

                    <div className="flex shrink-0 items-start gap-2 sm:justify-end">
                      {done ? (
                        <Button asChild className="rounded-xl" size="sm" variant="outline">
                          <Link href={`/student/project-feedback/${round.id}`}>
                            Bekijken
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild className="rounded-xl" size="sm">
                          <Link href={`/student/project-feedback/${round.id}`}>
                            Invullen
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
