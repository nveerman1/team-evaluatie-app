import api from "@/lib/api";
import {
  GradeDraftRequest,
  GradePublishRequest,
  GradePreviewResponse,
  PublishedGradeOut,
} from "@/dtos/grades.dto";

export const gradesService = {
  async listGrades(
    evaluationId: number,
    signal?: AbortSignal,
    courseId?: number,
  ) {
    const q = new URLSearchParams({ evaluation_id: String(evaluationId) });
    if (courseId != null) q.set("course_id", String(courseId));
    const { data } = await api.get<PublishedGradeOut[]>(
      `/grades?${q.toString()}`,
      { signal },
    );
    return data;
  },

  async previewGrades(
    evaluationId: number,
    signal?: AbortSignal,
    groupGrade?: number | null,
    courseId?: number,
  ) {
    const q = new URLSearchParams({ evaluation_id: String(evaluationId) });
    if (groupGrade != null) q.set("group_grade", String(groupGrade));
    if (courseId != null) q.set("course_id", String(courseId));
    const { data } = await api.get<GradePreviewResponse>(
      `/grades/preview?${q.toString()}`,
      { signal },
    );
    return data;
  },

  async saveDraft(payload: GradeDraftRequest) {
    await api.post(`/grades/draft`, payload);
  },

  async publish(payload: GradePublishRequest) {
    await api.post(`/grades/publish`, payload);
  },
};
