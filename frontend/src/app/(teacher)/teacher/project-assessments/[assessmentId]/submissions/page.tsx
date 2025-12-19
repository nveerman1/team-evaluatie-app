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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Filter states
  const [missingOnly, setMissingOnly] = useState(false);
  const [actionRequiredOnly, setActionRequiredOnly] = useState(false);
  const [docType, setDocType] = useState<string | null>(null);

  // Check authentication before making API calls
  useEffect(() => {
    const email = localStorage.getItem('x_user_email') || sessionStorage.getItem('x_user_email');
    if (!email) {
      console.error('No user email found in storage - redirecting to login');
      router.push('/');
      return;
    }
    setIsAuthenticated(true);
  }, [router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSubmissions();
    }
  }, [assessmentId, isAuthenticated]);

  useEffect(() => {
    applyFilters();
  }, [submissions, missingOnly, actionRequiredOnly, docType]);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const data = await submissionService.getSubmissionsForAssessment(assessmentId);
      setSubmissions(data.items);
    } catch (err: any) {
      console.error('Failed to load submissions:', err);
      toast.error('Kon inleveringen niet laden');
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

  if (!isAuthenticated || loading) {
    return <Loading />;
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
      <div>
        <h1 className="text-3xl font-bold">Inleveringen</h1>
        <p className="text-muted-foreground mt-2">
          Bekijk en beoordeel de ingeleverde documenten van teams.
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Totaal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ontbrekend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.missing}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ingeleverd</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.submitted}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Akkoord</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.ok}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Actie vereist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.actionRequired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border">
        <SubmissionFilters
          missingOnly={missingOnly}
          setMissingOnly={setMissingOnly}
          actionRequiredOnly={actionRequiredOnly}
          setActionRequiredOnly={setActionRequiredOnly}
          docType={docType}
          setDocType={setDocType}
        />
      </div>

      {/* Submissions Table */}
      <SubmissionsTable
        submissions={filteredSubmissions}
        onStatusChange={handleStatusChange}
        onOpenRubric={handleOpenRubric}
      />
    </div>
  );
}
