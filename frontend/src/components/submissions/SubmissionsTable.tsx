'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SubmissionWithTeamInfo } from '@/dtos/submission.dto';
import { ExternalLink, ChevronDown, Circle, CheckCircle, Lock, LinkIcon, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const MAX_DISPLAYED_MEMBERS = 2;

interface SubmissionsTableProps {
  submissions: SubmissionWithTeamInfo[];
  onStatusChange: (submissionId: number, status: string) => Promise<void>;
  onOpenRubric?: (teamId: number) => void;
}

const statusConfig = {
  missing: {
    label: 'Nog niet ingeleverd',
    icon: Circle,
    color: 'text-gray-500',
  },
  submitted: {
    label: 'Ingeleverd',
    icon: AlertCircle,
    color: 'text-blue-600',
  },
  ok: {
    label: 'Akkoord',
    icon: CheckCircle,
    color: 'text-green-600',
  },
  access_requested: {
    label: 'Toegang vereist',
    icon: Lock,
    color: 'text-orange-600',
  },
  broken: {
    label: 'Link werkt niet',
    icon: LinkIcon,
    color: 'text-red-600',
  },
} as const;

type SubmissionStatus = keyof typeof statusConfig;

const isValidStatus = (status: string): status is SubmissionStatus => {
  return status in statusConfig;
};

export function SubmissionsTable({
  submissions,
  onStatusChange,
  onOpenRubric,
}: SubmissionsTableProps) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  const handleStatusChange = async (submissionId: number, status: string) => {
    await onStatusChange(submissionId, status);
  };

  const toggleSort = () => {
    if (sortOrder === null) {
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortOrder(null);
    }
  };

  const sortedSubmissions = useMemo(() => {
    if (sortOrder === null) {
      return submissions;
    }

    return [...submissions].sort((a, b) => {
      const aTeamNum = a.team_number ?? 0;
      const bTeamNum = b.team_number ?? 0;
      
      if (sortOrder === 'asc') {
        return aTeamNum - bTeamNum;
      } else {
        return bTeamNum - aTeamNum;
      }
    });
  }, [submissions, sortOrder]);

  if (submissions.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm py-12 text-center">
        <p className="text-muted-foreground">Geen inleveringen gevonden</p>
      </div>
    );
  }

  const SortIcon = sortOrder === 'asc' ? ArrowUp : sortOrder === 'desc' ? ArrowDown : ArrowUpDown;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-medium text-muted-foreground">
        <button 
          onClick={toggleSort}
          className="col-span-2 flex items-center gap-1 hover:text-foreground transition-colors text-left"
        >
          Team
          <SortIcon className="h-3.5 w-3.5" />
        </button>
        <div className="col-span-3">Teamleden</div>
        <div className="col-span-3">Document</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1 whitespace-nowrap">Ingeleverd op</div>
        <div className="col-span-1 text-right">Actie</div>
      </div>

      {/* Rows */}
      {sortedSubmissions.map((item) => {
        const status = item.submission.status;
        const validStatus = isValidStatus(status) ? status : 'missing';
        const StatusIcon = statusConfig[validStatus].icon;
        const statusColor = statusConfig[validStatus].color;
        const statusLabel = statusConfig[validStatus].label;
        const hasUrl = !!item.submission.url;
        const isMissing = status === 'missing';

        return (
          <div
            key={item.submission.id}
            className="grid grid-cols-12 items-center gap-3 border-b px-4 py-4 hover:bg-slate-50/60"
          >
            {/* Team */}
            <div className="col-span-2 font-medium">
              {item.team_name}
              {item.team_number && ` (Team ${item.team_number})`}
            </div>

            {/* Teamleden */}
            <div className="col-span-3 text-xs text-muted-foreground">
              {item.members.slice(0, MAX_DISPLAYED_MEMBERS).map((m) => m.name).join(' · ')}
              {item.members.length > MAX_DISPLAYED_MEMBERS && ` · +${item.members.length - MAX_DISPLAYED_MEMBERS}`}
            </div>

            {/* Document */}
            <div className="col-span-3">
              {hasUrl ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1"
                  onClick={() => window.open(item.submission.url || '', '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  {item.submission.doc_type === 'report' && 'Open verslag'}
                  {item.submission.doc_type === 'slides' && 'Open presentatie'}
                  {item.submission.doc_type === 'attachment' && 'Open bijlage'}
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>

            {/* Status Dropdown */}
            <div className="col-span-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 w-full justify-between gap-2"
                  >
                    <span className="flex items-center gap-1.5">
                      <StatusIcon className={`h-3.5 w-3.5 ${statusColor}`} />
                      <span className="text-xs">{statusLabel}</span>
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[200px]">
                  <DropdownMenuItem onClick={() => handleStatusChange(item.submission.id, 'missing')}>
                    <Circle className="mr-2 h-4 w-4 text-gray-500" />
                    Nog niet ingeleverd
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(item.submission.id, 'submitted')}>
                    <AlertCircle className="mr-2 h-4 w-4 text-blue-600" />
                    Ingeleverd
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(item.submission.id, 'ok')}>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    Akkoord
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(item.submission.id, 'access_requested')}>
                    <Lock className="mr-2 h-4 w-4 text-orange-600" />
                    Toegang vereist
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(item.submission.id, 'broken')}>
                    <LinkIcon className="mr-2 h-4 w-4 text-red-600" />
                    Link werkt niet
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Ingeleverd op */}
            <div className="col-span-1 whitespace-nowrap text-sm text-muted-foreground">
              {item.submission.submitted_at
                ? new Date(item.submission.submitted_at).toLocaleDateString('nl-NL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                : '—'}
            </div>

            {/* Actie */}
            <div className="col-span-1 flex justify-end">
              {isMissing ? (
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="h-8"
                  disabled
                  title="Herinnering sturen (nog niet geïmplementeerd)"
                >
                  Herinner
                </Button>
              ) : (
                onOpenRubric && (
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => onOpenRubric(item.submission.project_team_id)}
                  >
                    Nakijken
                  </Button>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
