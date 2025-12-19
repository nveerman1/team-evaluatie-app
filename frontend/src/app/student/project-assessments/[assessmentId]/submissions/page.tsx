'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { submissionService } from '@/services/submission.service';
import { SubmissionOut, SubmissionCreate } from '@/dtos/submission.dto';
import { SubmissionCard } from '@/components/submissions/SubmissionCard';
import { Loading } from '@/components';
import { toast } from 'sonner';

export default function StudentSubmissionsPage() {
  const params = useParams();
  const assessmentId = parseInt(params.assessmentId as string);
  
  const [submissions, setSubmissions] = useState<SubmissionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<number | null>(null);

  useEffect(() => {
    loadSubmissions();
  }, [assessmentId]);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const data = await submissionService.getMyTeamSubmissions(assessmentId);
      setSubmissions(data);
      
      // Get team ID from first submission if available
      if (data.length > 0 && data[0].project_team_id) {
        setTeamId(data[0].project_team_id);
      }
    } catch (err: any) {
      console.error('Failed to load submissions:', err);
      toast.error('Kon inleveringen niet laden');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (docType: string, url: string) => {
    if (!teamId) {
      toast.error('Team niet gevonden');
      return;
    }

    const createData: SubmissionCreate = {
      doc_type: docType as 'report' | 'slides' | 'attachment',
      url,
      version_label: 'v1',
    };

    await submissionService.submitLink(assessmentId, teamId, createData);
    await loadSubmissions();
  };

  const handleClear = async (submissionId: number) => {
    await submissionService.clearSubmission(submissionId);
    await loadSubmissions();
  };

  if (loading) {
    return <Loading />;
  }

  const reportSubmission = submissions.find((s) => s.doc_type === 'report');
  const slidesSubmission = submissions.find((s) => s.doc_type === 'slides');

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inleveren</h1>
        <p className="text-muted-foreground mt-2">
          Upload je documenten naar SharePoint en deel de links hier.
          Alleen HTTPS links naar SharePoint/OneDrive zijn toegestaan.
        </p>
      </div>

      <div className="space-y-6">
        <SubmissionCard
          docType="report"
          label="Verslag"
          submission={reportSubmission}
          onSubmit={handleSubmit}
          onClear={handleClear}
        />

        <SubmissionCard
          docType="slides"
          label="Presentatie"
          submission={slidesSubmission}
          onSubmit={handleSubmit}
          onClear={handleClear}
        />
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Tips voor inleveren:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
          <li>Upload je bestanden eerst naar SharePoint of OneDrive</li>
          <li>Klik met de rechtermuisknop op het bestand en kies "Delen"</li>
          <li>Zorg dat iedereen met de link het bestand kan bekijken</li>
          <li>Kopieer de link en plak deze hier</li>
          <li>Controleer na het inleveren of de link werkt door erop te klikken</li>
        </ul>
      </div>
    </div>
  );
}
