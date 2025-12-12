import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, MessageSquare } from "lucide-react";
import { CompetencyWindow } from "@/dtos";
import Link from "next/link";

type ScanDashboardCardProps = {
  window: CompetencyWindow;
  hasInvites?: boolean;
  onShowInvites?: () => void;
};

export function ScanDashboardCard({ 
  window, 
  hasInvites = false,
  onShowInvites 
}: ScanDashboardCardProps) {
  const isOpen = window.status === "open";
  
  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {window.title}
              </h3>
              <Badge
                className={
                  isOpen
                    ? "rounded-full bg-slate-900 text-white"
                    : "rounded-full bg-slate-100 text-slate-700"
                }
              >
                {isOpen ? "Open" : "Gesloten"}
              </Badge>
            </div>
            <div className="text-sm text-slate-600">
              Sluit op: {window.end_date ? new Date(window.end_date).toLocaleDateString("nl-NL") : "Onbekend"}
            </div>

            {hasInvites && onShowInvites && (
              <button 
                onClick={onShowInvites}
                className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                <MessageSquare className="h-4 w-4" /> Bekijk uitnodigingen
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button asChild className="rounded-xl" size="sm">
              <Link href={`/student/competency/scan/${window.id}`}>
                Verder
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            {window.require_goal && (
              <Button asChild variant="secondary" size="sm" className="rounded-xl">
                <Link href={`/student/competency/goal/${window.id}`}>
                  Leerdoel
                </Link>
              </Button>
            )}
            {window.require_reflection && (
              <Button asChild variant="secondary" size="sm" className="rounded-xl">
                <Link href={`/student/competency/reflection/${window.id}`}>
                  Reflectie
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
