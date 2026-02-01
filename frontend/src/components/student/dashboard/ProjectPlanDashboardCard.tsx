import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, Lock } from "lucide-react";
import { ProjectPlanDetail, PlanStatus } from "@/dtos/projectplan.dto";
import Link from "next/link";

type ProjectPlanDashboardCardProps = {
  projectPlan: ProjectPlanDetail;
};

function getStatusBadgeProps(status: PlanStatus, locked: boolean) {
  if (locked) {
    return {
      label: "GO (Vergrendeld)",
      className: "rounded-full bg-green-100 text-green-800 border-green-200",
    };
  }
  
  switch (status) {
    case PlanStatus.GO:
      return {
        label: "GO",
        className: "rounded-full bg-green-100 text-green-800 border-green-200",
      };
    case PlanStatus.NO_GO:
      return {
        label: "NO-GO",
        className: "rounded-full bg-red-100 text-red-800 border-red-200",
      };
    case PlanStatus.INGEDIEND:
      return {
        label: "Ingediend",
        className: "rounded-full bg-blue-100 text-blue-800 border-blue-200",
      };
    case PlanStatus.CONCEPT:
    default:
      return {
        label: "Concept",
        className: "rounded-full bg-slate-100 text-slate-800 border-slate-200",
      };
  }
}

export function ProjectPlanDashboardCard({ projectPlan }: ProjectPlanDashboardCardProps) {
  // Get the current student's team data (first team in the list, assuming student only has one team per project)
  const myTeam = projectPlan.teams?.[0];
  
  if (!myTeam) {
    return null; // No team data for this student
  }

  const badgeProps = getStatusBadgeProps(myTeam.status, myTeam.locked);
  
  // Calculate progress (sections filled out of 8)
  const totalSections = 8;
  const filledSections = myTeam.sections.filter(
    (s) => s.status !== 'empty'
  ).length;
  const progressPercentage = (filledSections / totalSections) * 100;

  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {projectPlan.project_name}
              </h3>
              <Badge className={badgeProps.className}>
                {badgeProps.label}
              </Badge>
              {myTeam.locked && (
                <Lock className="h-4 w-4 text-green-600" />
              )}
            </div>
            
            {myTeam.title && (
              <div className="text-sm text-slate-600">
                {myTeam.title}
              </div>
            )}
            
            <div className="text-sm text-slate-600">
              Team: {myTeam.team_members.join(", ")}
            </div>

            {/* Progress bar */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Voortgang</span>
                <span>{filledSections} / {totalSections} secties ingevuld</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            {/* Teacher feedback if present */}
            {myTeam.global_teacher_note && (
              <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs font-medium text-amber-900 mb-1">Feedback docent:</p>
                <p className="text-xs text-amber-800">{myTeam.global_teacher_note}</p>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-start gap-2 sm:justify-end">
            <Button 
              asChild 
              className="rounded-xl" 
              size="sm"
              disabled={myTeam.locked}
            >
              <Link href={`/student/projectplans/${myTeam.id}`}>
                {myTeam.locked ? "Bekijken" : "Bewerken"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
