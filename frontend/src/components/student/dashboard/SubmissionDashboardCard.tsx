import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Upload, CheckCircle, AlertCircle, Calendar } from "lucide-react";
import { ProjectAssessmentListItem } from "@/dtos";
import { studentStyles } from "@/styles/student-dashboard.styles";
import Link from "next/link";

type SubmissionDashboardCardProps = {
  assessment: ProjectAssessmentListItem & {
    team_number?: number | null;
    project_end_date?: string | null;
  };
};

export function SubmissionDashboardCard({ 
  assessment 
}: SubmissionDashboardCardProps) {
  // For now, we don't have submission status in the assessment data
  // This will be enhanced when we fetch actual submission data
  const hasSubmitted = false; // Placeholder
  
  // Format deadline date
  const formatDeadline = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('nl-NL', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    } catch {
      return null;
    }
  };

  const deadline = formatDeadline(assessment.project_end_date);
  
  return (
    <Card className={studentStyles.cards.listCard.container}>
      <CardContent className={studentStyles.cards.listCard.content}>
        <div className={studentStyles.cards.listCard.flexContainer}>
          <div className={studentStyles.cards.listCard.leftSection}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={studentStyles.typography.cardTitle}>
                {assessment.title}
              </h3>
              {hasSubmitted ? (
                <Badge className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Ingeleverd
                </Badge>
              ) : (
                <Badge className="rounded-full bg-amber-50 text-amber-700 border-amber-200">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Nog inleveren
                </Badge>
              )}
            </div>
            <div className={studentStyles.typography.infoText}>
              Team: {assessment.team_number ? `Team ${assessment.team_number}` : (assessment.group_name || "Onbekend")}
            </div>
            {deadline && (
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Calendar className="h-4 w-4" />
                <span>Deadline: {deadline}</span>
              </div>
            )}
            <div className={studentStyles.typography.metaTextSmall}>
              Docent: {assessment.teacher_name || "Onbekend"}
            </div>
          </div>

          <div className={studentStyles.cards.listCard.rightSection}>
            <Button asChild className={studentStyles.buttons.primary} size="sm">
              <Link href={`/student/project-assessments/${assessment.id}/submissions`}>
                <Upload className="mr-1 h-4 w-4" />
                Inleveren
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
