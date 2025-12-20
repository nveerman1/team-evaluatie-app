'use client';

import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  // Determine current status tab value
  const statusValue = missingOnly ? 'ontbrekend' : actionRequiredOnly ? 'actie' : 'alle';
  
  const handleStatusChange = (value: string) => {
    setMissingOnly(value === 'ontbrekend');
    setActionRequiredOnly(value === 'actie');
  };
  
  // Determine current doc type tab value
  const docTypeValue = docType === 'report' ? 'verslag' : docType === 'slides' ? 'presentatie' : 'alle';
  
  const handleDocTypeChange = (value: string) => {
    if (value === 'alle') setDocType(null);
    else if (value === 'verslag') setDocType('report');
    else if (value === 'presentatie') setDocType('slides');
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Status</span>
        <Tabs value={statusValue} onValueChange={handleStatusChange}>
          <TabsList>
            <TabsTrigger value="alle">Alle</TabsTrigger>
            <TabsTrigger value="ontbrekend">Alleen ontbrekend</TabsTrigger>
            <TabsTrigger value="actie">Actie vereist</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
        <span className="text-sm font-medium">Document type</span>
        <Tabs value={docTypeValue} onValueChange={handleDocTypeChange}>
          <TabsList>
            <TabsTrigger value="alle">Alle</TabsTrigger>
            <TabsTrigger value="verslag">Verslag</TabsTrigger>
            <TabsTrigger value="presentatie">Presentatie</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
