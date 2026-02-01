import { useState, useEffect } from 'react';
import { projectPlanService } from '@/services/projectplan.service';
import { ProjectPlanDetail } from '@/dtos/projectplan.dto';

export function useStudentProjectPlans() {
  const [projectPlans, setProjectPlans] = useState<ProjectPlanDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjectPlans() {
      setLoading(true);
      setError(null);
      try {
        const data = await projectPlanService.listMyProjectPlans();
        setProjectPlans(data);
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || 'Failed to load projectplans');
      } finally {
        setLoading(false);
      }
    }

    loadProjectPlans();
  }, []);

  return { projectPlans, loading, error, refetch: () => {
    setLoading(true);
    setError(null);
    projectPlanService.listMyProjectPlans()
      .then(data => setProjectPlans(data))
      .catch(e => setError(e?.response?.data?.detail || e?.message || 'Failed to load projectplans'))
      .finally(() => setLoading(false));
  }};
}
