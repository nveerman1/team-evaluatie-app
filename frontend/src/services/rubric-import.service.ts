import api from "@/lib/api";

export interface ResolvedLearningObjective {
  order: number;
  found: boolean;
  title?: string;
  domain?: string;
}

export interface PreviewCriterion {
  name: string;
  category?: string;
  weight: number;
  has_descriptors: boolean;
  learning_objectives: ResolvedLearningObjective[];
}

export interface PreviewRubric {
  title: string;
  scope: string;
  criteria_count: number;
  criteria: PreviewCriterion[];
}

export interface CsvPreviewResult {
  rubrics: PreviewRubric[];
  errors: string[];
  warnings: string[];
  valid: boolean;
}

export interface CsvImportResult {
  created_rubrics: number;
  created_criteria: number;
  linked_objectives: number;
  errors: string[];
  warnings: string[];
  rubric_ids: number[];
}

export const rubricImportService = {
  /**
   * Preview CSV import without saving to database
   */
  async preview(
    file: File,
    subjectId?: number | null,
  ): Promise<CsvPreviewResult> {
    const formData = new FormData();
    formData.append("file", file);
    const params = subjectId ? `?subject_id=${subjectId}` : "";
    const response = await api.post<CsvPreviewResult>(
      `/rubrics/import-csv/preview${params}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data;
  },

  /**
   * Import rubrics from CSV file
   */
  async importCsv(
    file: File,
    subjectId?: number | null,
  ): Promise<CsvImportResult> {
    const formData = new FormData();
    formData.append("file", file);
    const params = subjectId ? `?subject_id=${subjectId}` : "";
    const response = await api.post<CsvImportResult>(
      `/rubrics/import-csv${params}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data;
  },
};
