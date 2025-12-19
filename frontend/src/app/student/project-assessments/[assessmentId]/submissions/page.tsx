'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { submissionService } from '@/services/submission.service';
import { SubmissionOut, SubmissionCreate } from '@/dtos/submission.dto';
import { SubmissionCard } from '@/components/submissions/SubmissionCard';
import { Loading } from '@/components';
import { toast } from '@/lib/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, Presentation } from 'lucide-react';
import { studentStyles } from '@/styles/student-dashboard.styles';

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
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
        <Loading />
      </div>
    );
  }

  const reportSubmission = submissions.find((s) => s.doc_type === 'report');
  const slidesSubmission = submissions.find((s) => s.doc_type === 'slides');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className={studentStyles.typography.pageTitle}>
            <Upload className="inline-block mr-3 h-8 w-8 text-slate-700" />
            Inleveren
          </h1>
          <p className={studentStyles.typography.pageSubtitle}>
            Upload je documenten naar SharePoint en deel de links hier.
            Alleen HTTPS links naar SharePoint/OneDrive zijn toegestaan.
          </p>
        </div>

        {/* Info Card */}
        <Card className="rounded-2xl border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <Upload className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-2">Tips voor inleveren</h3>
                <ul className="space-y-1.5 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>Upload je bestanden eerst naar SharePoint of OneDrive</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>Klik met de rechtermuisknop op het bestand en kies "Delen"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>Zorg dat iedereen met de link het bestand kan bekijken</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>Kopieer de link en plak deze hier</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>Controleer na het inleveren of de link werkt door erop te klikken</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submission Cards */}
        <div className="space-y-4">
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
      </div>
    </div>
  );
}
