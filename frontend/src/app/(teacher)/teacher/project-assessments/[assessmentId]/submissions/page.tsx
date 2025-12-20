'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { submissionService } from '@/services/submission.service';
import { SubmissionWithTeamInfo, SubmissionStatusUpdate } from '@/dtos/submission.dto';
import { SubmissionsTable } from '@/components/submissions/SubmissionsTable';
import { SubmissionFilters } from '@/components/submissions/SubmissionFilters';
import { Loading } from '@/components';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TeacherSubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = parseInt(params.assessmentId as string);
  
  const [submissions, setSubmissions] = useState<SubmissionWithTeamInfo[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<SubmissionWithTeamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [missingOnly, setMissingOnly] = useState(false);
  const [actionRequiredOnly, setActionRequiredOnly] = useState(false);
  const [docType, setDocType] = useState<string | null>(null);

  useEffect(() => {
    if (assessmentId) {
      loadSubmissions();
    }
  }, [assessmentId]);

  useEffect(() => {
    applyFilters();
  }, [submissions, missingOnly, actionRequiredOnly, docType]);

  const loadSubmissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await submissionService.getSubmissionsForAssessment(assessmentId);
      setSubmissions(data.items);
    } catch (err: any) {
      console.error('Failed to load submissions:', err);
      
      // Handle different error types
      if (err.name === 'ApiAuthError') {
        if (err.status === 403) {
          // Permission error - user is authenticated but doesn't own this assessment
          setError('Je hebt geen toegang tot deze inleveringen. Je moet de eigenaar van deze projectbeoordeling zijn.');
        } else if (err.status === 401) {
          // Authentication error - not logged in
          setError('Je bent niet ingelogd. Log opnieuw in.');
        }
      } else {
        setError('Kon inleveringen niet laden. Probeer het opnieuw.');
      }
      
      toast.error(error || 'Kon inleveringen niet laden');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...submissions];

    if (missingOnly) {
      filtered = filtered.filter((item) => item.submission.status === 'missing');
    }

    if (actionRequiredOnly) {
      filtered = filtered.filter(
        (item) =>
          item.submission.status === 'access_requested' ||
          item.submission.status === 'broken' ||
          item.submission.status === 'submitted'
      );
    }

    if (docType) {
      filtered = filtered.filter((item) => item.submission.doc_type === docType);
    }

    setFilteredSubmissions(filtered);
  };

  const handleStatusChange = async (submissionId: number, status: string) => {
    try {
      const updateData: SubmissionStatusUpdate = {
        status: status as any,
      };
      
      await submissionService.updateStatus(submissionId, updateData);
      
      // Optimistic update
      setSubmissions((prev) =>
        prev.map((item) =>
          item.submission.id === submissionId
            ? { ...item, submission: { ...item.submission, status: status as any } }
            : item
        )
      );
      
      toast.success('Status bijgewerkt');
    } catch (err: any) {
      console.error('Failed to update status:', err);
      toast.error('Kon status niet bijwerken');
      // Reload to get fresh data
      await loadSubmissions();
    }
  };

  const handleOpenRubric = (teamId: number) => {
    router.push(`/teacher/project-assessments/${assessmentId}/edit?team=${teamId}`);
  };

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle>Fout bij laden van inleveringen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded"
            >
              Terug
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = {
    total: submissions.length,
    missing: submissions.filter((s) => s.submission.status === 'missing').length,
    submitted: submissions.filter((s) => s.submission.status === 'submitted').length,
    ok: submissions.filter((s) => s.submission.status === 'ok').length,
    actionRequired: submissions.filter(
      (s) => s.submission.status === 'access_requested' || s.submission.status === 'broken'
    ).length,
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Totaal</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ontbrekend</p>
            <p className="text-2xl font-bold text-red-600">{stats.missing}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ingeleverd</p>
            <p className="text-2xl font-bold text-blue-600">{stats.submitted}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Akkoord</p>
            <p className="text-2xl font-bold text-green-600">{stats.ok}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Actie vereist</p>
            <p className="text-2xl font-bold text-orange-600">{stats.actionRequired}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <SubmissionFilters
            missingOnly={missingOnly}
            setMissingOnly={setMissingOnly}
            actionRequiredOnly={actionRequiredOnly}
            setActionRequiredOnly={setActionRequiredOnly}
            docType={docType}
            setDocType={setDocType}
          />
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <SubmissionsTable
        submissions={filteredSubmissions}
        onStatusChange={handleStatusChange}
        onOpenRubric={handleOpenRubric}
      />
    </div>
  );
}
