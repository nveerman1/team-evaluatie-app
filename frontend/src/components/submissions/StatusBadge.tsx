import React from 'react';
import { Badge } from '@/components/ui/badge';

type SubmissionStatus = 'missing' | 'submitted' | 'ok' | 'access_requested' | 'broken';

interface StatusBadgeProps {
  status: SubmissionStatus;
  className?: string;
}

const statusConfig: Record<SubmissionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  missing: {
    label: 'Nog niet ingeleverd',
    variant: 'outline',
  },
  submitted: {
    label: 'Ingeleverd',
    variant: 'secondary',
  },
  ok: {
    label: '✅ Akkoord',
    variant: 'default',
  },
  access_requested: {
    label: '🔒 Toegang vereist',
    variant: 'destructive',
  },
  broken: {
    label: '🔗 Link werkt niet',
    variant: 'destructive',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.missing;
  
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
