import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, ChevronRight } from "lucide-react";
import { ActionChip } from "./helpers";
import { StudentEvaluation } from "@/dtos";
import Link from "next/link";

type EvaluationDashboardCardProps = {
  evaluation: StudentEvaluation;
};

export function EvaluationDashboardCard({ evaluation }: EvaluationDashboardCardProps) {
  // Check actual status from the evaluation
  const isOpen = evaluation.status === "open";
  const isCompleted = evaluation.progress === 100;
  
  // Get deadlines from evaluation settings
  const reviewDeadline = evaluation.settings?.deadlines?.review || evaluation.deadlines?.review;
  const reflectionDeadline = evaluation.settings?.deadlines?.reflection || evaluation.deadlines?.reflection;
  
  const peerLabel = `Peer-evaluaties (${evaluation.peersCompleted}/${evaluation.peersTotal})`;
  
  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-slate-900">
                {evaluation.title}
              </h3>
              <Badge
                className={
                  isOpen
                    ? "rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                    : "rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-200"
                }
              >
                {isOpen ? "Open" : "Gesloten"}
              </Badge>
              {isCompleted && isOpen && (
                <Badge className="rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                  Afgerond
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {reviewDeadline ? `Deadline: ${reviewDeadline}` : reflectionDeadline ? `Deadline: ${reflectionDeadline}` : "Geen deadline"}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <ActionChip done={evaluation.selfCompleted} label="Zelfbeoordeling" />
              <ActionChip
                done={evaluation.peersCompleted === evaluation.peersTotal && evaluation.peersTotal > 0}
                label={peerLabel}
              />
              <ActionChip done={evaluation.reflectionCompleted} label="Reflectie" />
            </div>

            {/* Progress bar */}
            <div className="mt-3 max-w-md">
              <Progress 
                className="h-3 [&>div]:bg-indigo-500"
                value={evaluation.progress}
              />
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-start gap-2 sm:justify-end">
            {isOpen && !isCompleted ? (
              <Button asChild className="rounded-xl bg-slate-900 hover:bg-slate-800" size="sm">
                <Link href={`/student/${evaluation.id}?step=${evaluation.nextStep || 1}`}>
                  Verder
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="secondary" size="sm" className="rounded-xl">
                <Link href={`/student/evaluation/${evaluation.id}/overzicht`}>
                  {isOpen && isCompleted ? "Bekijk resultaat" : "Terugkijken"}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="rounded-xl text-slate-700">
              <Link href={`/student/evaluation/${evaluation.id}/overzicht`}>
                Feedback
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="rounded-xl text-slate-700">
              <Link href={`/student/evaluation/${evaluation.id}/reflectie`}>
                Reflectie
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
