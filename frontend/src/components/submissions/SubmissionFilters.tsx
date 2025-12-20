'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SubmissionFiltersProps {
  missingOnly: boolean;
  setMissingOnly: (value: boolean) => void;
  actionRequiredOnly: boolean;
  setActionRequiredOnly: (value: boolean) => void;
  docType: string | null;
  setDocType: (value: string | null) => void;
}

export function SubmissionFilters({
  missingOnly,
  setMissingOnly,
  actionRequiredOnly,
  setActionRequiredOnly,
  docType,
  setDocType,
}: SubmissionFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={missingOnly ? 'default' : 'secondary'}
        size="sm"
        onClick={() => setMissingOnly(!missingOnly)}
      >
        Alleen ontbrekend
        {missingOnly && <Badge variant="secondary" className="ml-2">Actief</Badge>}
      </Button>
      
      <Button
        variant={actionRequiredOnly ? 'default' : 'secondary'}
        size="sm"
        onClick={() => setActionRequiredOnly(!actionRequiredOnly)}
      >
        Actie vereist
        {actionRequiredOnly && <Badge variant="secondary" className="ml-2">Actief</Badge>}
      </Button>

      <div className="flex gap-2 items-center">
        <span className="text-sm text-muted-foreground">Document type:</span>
        <Button
          variant={docType === null ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setDocType(null)}
        >
          Alle
        </Button>
        <Button
          variant={docType === 'report' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setDocType('report')}
        >
          Verslag
        </Button>
        <Button
          variant={docType === 'slides' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setDocType('slides')}
        >
          Presentatie
        </Button>
      </div>
    </div>
  );
}
