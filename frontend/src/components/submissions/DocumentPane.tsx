'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, FileText, Presentation, ChevronLeft, ChevronRight } from 'lucide-react';
import { SubmissionOut } from '@/dtos/submission.dto';

interface DocumentPaneProps {
  submissions: SubmissionOut[];
  teamId?: number;
  assessmentId: number;
  onClose?: () => void;
}

export function DocumentPane({ submissions, teamId, assessmentId, onClose }: DocumentPaneProps) {
  const [selectedDocType, setSelectedDocType] = useState<'report' | 'slides'>('report');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const reportSubmission = submissions.find((s) => s.doc_type === 'report');
  const slidesSubmission = submissions.find((s) => s.doc_type === 'slides');
  
  const currentSubmission = selectedDocType === 'report' ? reportSubmission : slidesSubmission;

  if (isCollapsed) {
    return (
      <div className="fixed right-0 top-0 bottom-0 w-12 bg-gray-100 border-l border-gray-200 flex items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(false)}
          className="p-2"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-lg">Ingeleverde documenten</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(true)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          )}
        </div>
      </div>

      {/* Document type toggle */}
      <div className="flex gap-2 p-4 border-b border-gray-200">
        <Button
          variant={selectedDocType === 'report' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setSelectedDocType('report')}
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          Verslag
        </Button>
        <Button
          variant={selectedDocType === 'slides' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setSelectedDocType('slides')}
          className="flex items-center gap-2"
        >
          <Presentation className="h-4 w-4" />
          Presentatie
        </Button>
      </div>

      {/* Document content */}
      <div className="flex-1 overflow-auto p-4">
        {currentSubmission?.url ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Status: {currentSubmission.status}</p>
                {currentSubmission.submitted_at && (
                  <p className="text-xs text-muted-foreground">
                    Ingeleverd op: {new Date(currentSubmission.submitted_at).toLocaleString('nl-NL')}
                  </p>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(currentSubmission.url || '', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in nieuw tabblad
              </Button>
            </div>

            {/* Try to embed the document */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Document voorbeeld</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-gray-50 rounded border border-gray-200 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <ExternalLink className="h-8 w-8 mx-auto text-gray-400" />
                    <p className="text-sm text-gray-600">
                      Klik op "Open in nieuw tabblad" om het document te bekijken
                    </p>
                    <p className="text-xs text-gray-500">
                      {currentSubmission.url}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {currentSubmission.status === 'access_requested' && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800 font-medium">
                  ⚠️ Je hebt aangegeven dat je het document niet kunt openen. Studenten zijn op de hoogte gesteld.
                </p>
              </div>
            )}

            {currentSubmission.status === 'broken' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800 font-medium">
                  ❌ Je hebt aangegeven dat de link niet werkt. Studenten zijn op de hoogte gesteld.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <FileText className="h-12 w-12 mx-auto text-gray-300" />
              <p className="text-gray-500">Nog niet ingeleverd</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
