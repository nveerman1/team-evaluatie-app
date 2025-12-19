'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from './StatusBadge';
import { SubmissionWithTeamInfo } from '@/dtos/submission.dto';
import { ExternalLink } from 'lucide-react';

interface SubmissionsTableProps {
  submissions: SubmissionWithTeamInfo[];
  onStatusChange: (submissionId: number, status: string) => Promise<void>;
  onOpenRubric?: (teamId: number) => void;
}

export function SubmissionsTable({
  submissions,
  onStatusChange,
  onOpenRubric,
}: SubmissionsTableProps) {
  const handleStatusChange = async (submissionId: number, status: string) => {
    await onStatusChange(submissionId, status);
  };

  if (submissions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nog geen inleveringen</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team</TableHead>
            <TableHead>Leden</TableHead>
            <TableHead>Document</TableHead>
            <TableHead>Link</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ingeleverd op</TableHead>
            <TableHead>Acties</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((item) => (
            <TableRow key={item.submission.id}>
              <TableCell className="font-medium">
                {item.team_name}
                {item.team_number && ` (Team ${item.team_number})`}
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {item.members.slice(0, 2).map((m) => m.name).join(', ')}
                  {item.members.length > 2 && ` +${item.members.length - 2}`}
                </div>
              </TableCell>
              <TableCell>
                {item.submission.doc_type === 'report' && 'Verslag'}
                {item.submission.doc_type === 'slides' && 'Presentatie'}
                {item.submission.doc_type === 'attachment' && 'Bijlage'}
              </TableCell>
              <TableCell>
                {item.submission.url ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(item.submission.url || '', '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>
              <TableCell>
                <Select
                  value={item.submission.status}
                  onValueChange={(value) => handleStatusChange(item.submission.id, value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue>
                      <StatusBadge status={item.submission.status} />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="missing">Nog niet ingeleverd</SelectItem>
                    <SelectItem value="submitted">Ingeleverd</SelectItem>
                    <SelectItem value="ok">✅ Akkoord</SelectItem>
                    <SelectItem value="access_requested">🔒 Toegang vereist</SelectItem>
                    <SelectItem value="broken">🔗 Link werkt niet</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {item.submission.submitted_at ? (
                  <span className="text-sm">
                    {new Date(item.submission.submitted_at).toLocaleDateString('nl-NL')}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>
              <TableCell>
                {onOpenRubric && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenRubric(item.submission.project_team_id)}
                  >
                    Nakijken
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
