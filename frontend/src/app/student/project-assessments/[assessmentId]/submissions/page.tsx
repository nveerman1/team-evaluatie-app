'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { submissionService } from '@/services/submission.service';
import { SubmissionOut, SubmissionCreate } from '@/dtos/submission.dto';
import { SubmissionCard } from '@/components/submissions/SubmissionCard';
import { Loading } from '@/components';
import { toast } from '@/lib/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, ArrowLeft, Info } from 'lucide-react';
import { studentStyles } from '@/styles/student-dashboard.styles';

export default function StudentSubmissionsPage() {
  const params = useParams();
  const router = useRouter();
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
      setSubmissions(data.submissions);
      
      // Get team ID from response
      if (data.team_id) {
        setTeamId(data.team_id);
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
      <div className={studentStyles.layout.pageContainer}>
        <div className={studentStyles.layout.contentWrapper}>
          <Loading />
        </div>
      </div>
    );
  }

  const reportSubmission = submissions.find((s) => s.doc_type === 'report');
  const slidesSubmission = submissions.find((s) => s.doc_type === 'slides');

  return (
    <div className={studentStyles.layout.pageContainer}>
      {/* Header with dark background */}
      <div className={studentStyles.header.container}>
        <div className={studentStyles.header.wrapper}>
          <div className={studentStyles.header.flexContainer}>
            <div className={studentStyles.header.titleSection}>
              <h1 className={studentStyles.header.title}>
                <Upload className="inline-block mr-3 h-7 w-7" />
                Inleveren
              </h1>
              <p className={studentStyles.header.subtitle}>
                Upload je documenten naar SharePoint en deel de links hier
              </p>
            </div>
            <div className="flex gap-2 sm:self-start">
              <Button 
                variant="ghost" 
                onClick={() => router.back()}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Terug
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={studentStyles.layout.contentWrapper}>
        <div className="space-y-6">

          {/* Info Card */}
          <Card className={studentStyles.cards.infoCard.container}>
            <CardContent className={studentStyles.cards.infoCard.content}>
              <div className={studentStyles.cards.infoCard.flexContainer}>
                <div className={studentStyles.cards.infoCard.leftSection}>
                  <div className={studentStyles.cards.infoCard.titleRow}>
                    <Info className={studentStyles.cards.infoCard.icon} />
                    <p className={studentStyles.cards.infoCard.title}>
                      Tips voor inleveren
                    </p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <p className={studentStyles.typography.infoText}>
                      • Upload je bestanden eerst naar SharePoint of OneDrive
                    </p>
                    <p className={studentStyles.typography.infoText}>
                      • Klik met de rechtermuisknop op het bestand en kies "Delen"
                    </p>
                    <p className={studentStyles.typography.infoText}>
                      • Zorg dat iedereen met de link het bestand kan bekijken
                    </p>
                    <p className={studentStyles.typography.infoText}>
                      • Kopieer de link en plak deze hieronder
                    </p>
                    <p className={studentStyles.typography.infoText}>
                      • Controleer na het inleveren of de link werkt door erop te klikken
                    </p>
                  </div>
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
    </div>
  );
}
