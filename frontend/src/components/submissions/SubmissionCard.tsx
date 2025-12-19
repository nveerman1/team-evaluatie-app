'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from './StatusBadge';
import { SubmissionOut } from '@/dtos/submission.dto';
import { ExternalLink, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';

interface SubmissionCardProps {
  docType: 'report' | 'slides' | 'attachment';
  label: string;
  description?: string;
  submission?: SubmissionOut | null;
  onSubmit: (docType: string, url: string) => Promise<void>;
  onClear?: (submissionId: number) => Promise<void>;
  disabled?: boolean;
}

const DOC_TYPE_LABELS: Record<string, { title: string; description: string; placeholder: string }> = {
  report: {
    title: 'Verslag',
    description: 'Upload je verslag naar SharePoint en deel de link hier',
    placeholder: 'https://sharepoint.com/...',
  },
  slides: {
    title: 'Presentatie',
    description: 'Upload je presentatie naar SharePoint en deel de link hier',
    placeholder: 'https://sharepoint.com/...',
  },
  attachment: {
    title: 'Bijlage',
    description: 'Upload eventuele bijlagen naar SharePoint en deel de link hier',
    placeholder: 'https://sharepoint.com/...',
  },
};

export function SubmissionCard({
  docType,
  label,
  description,
  submission,
  onSubmit,
  onClear,
  disabled = false,
}: SubmissionCardProps) {
  const [url, setUrl] = useState(submission?.url || '');
  const [loading, setLoading] = useState(false);

  const config = DOC_TYPE_LABELS[docType] || DOC_TYPE_LABELS.report;

  const handleSubmit = async () => {
    if (!url || !url.trim()) {
      toast.error('Voer een geldige URL in');
      return;
    }

    // Client-side validation matching backend logic
    if (!url.startsWith('https://')) {
      toast.error('Alleen HTTPS URLs zijn toegestaan');
      return;
    }

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      const allowedHosts = ['sharepoint.com', '1drv.ms'];
      const allowedOfficeDomains = ['officeapps.live.com', 'view.officeapps.live.com'];
      
      const isAllowed = 
        allowedHosts.some(host => hostname.endsWith(host)) ||
        allowedOfficeDomains.some(domain => hostname === domain);
      
      if (!isAllowed) {
        toast.error('Alleen SharePoint/OneDrive links zijn toegestaan');
        return;
      }
    } catch (e) {
      toast.error('Ongeldige URL');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(docType, url);
      toast.success('Ingeleverd!');
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || 'Inleveren mislukt';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!submission?.id || !onClear) return;

    setLoading(true);
    try {
      await onClear(submission.id);
      setUrl('');
      toast.success('Inlevering verwijderd');
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || 'Verwijderen mislukt';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const hasChanged = url !== (submission?.url || '');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle>{label || config.title}</CardTitle>
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
            {!description && <CardDescription className="mt-1">{config.description}</CardDescription>}
          </div>
          {submission && <StatusBadge status={submission.status} className="ml-4" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={config.placeholder}
            disabled={disabled || loading}
            className="flex-1"
          />
          <Button
            onClick={handleSubmit}
            disabled={disabled || loading || !url || !hasChanged}
            variant={hasChanged ? 'default' : 'outline'}
          >
            {loading ? 'Bezig...' : hasChanged ? 'Inleveren' : 'Ingeleverd'}
          </Button>
        </div>

        <div className="flex gap-2">
          {url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(url, '_blank')}
              disabled={loading}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open link in nieuwe tab
            </Button>
          )}
          {submission?.url && onClear && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={disabled || loading}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Verwijder inlevering
            </Button>
          )}
        </div>

        {submission?.submitted_at && (
          <p className="text-sm text-muted-foreground">
            Laatst ingeleverd: {new Date(submission.submitted_at).toLocaleString('nl-NL')}
          </p>
        )}

        {submission?.status === 'access_requested' && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive font-medium">
              De docent kan je document niet openen. Controleer de deelrechten in SharePoint.
            </p>
          </div>
        )}

        {submission?.status === 'broken' && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive font-medium">
              De ingeleverde link werkt niet. Controleer de URL en lever opnieuw in.
            </p>
          </div>
        )}

        {submission?.status === 'ok' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800 font-medium">
              ✅ Je inlevering is goedgekeurd door de docent.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
