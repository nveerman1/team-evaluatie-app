import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { ProjectAssessmentListItem } from "@/dtos";
import Link from "next/link";

type ProjectAssessmentDashboardCardProps = {
  assessment: ProjectAssessmentListItem;
};

export function ProjectAssessmentDashboardCard({ 
  assessment 
}: ProjectAssessmentDashboardCardProps) {
  const isPublished = assessment.status === "published";
  const grade = assessment.final_grade || assessment.suggested_grade;
  
  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {assessment.title}
              </h3>
              <Badge
                className={
                  !isPublished
                    ? "rounded-full bg-slate-900 text-white"
                    : "rounded-full bg-slate-100 text-slate-700"
                }
              >
                {!isPublished ? "Open" : "Gesloten"}
              </Badge>
            </div>
            <div className="text-sm text-slate-600">
              Team: {assessment.group_name || "Onbekend"} • Beoordeeld door: {assessment.teacher_name || "Onbekend"}
            </div>
            <div className="text-sm text-slate-600">
              Gepubliceerd: {assessment.published_at ? new Date(assessment.published_at).toLocaleDateString("nl-NL") : "Nog niet gepubliceerd"}
            </div>
            {grade && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full bg-indigo-50 text-indigo-700">
                  Cijfer: {grade.toFixed(1)}
                </Badge>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-start gap-2 sm:justify-end">
            <Button asChild className="rounded-xl" size="sm">
              <Link href={`/student/project-assessments/${assessment.id}`}>
                Bekijk
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
