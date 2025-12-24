/**
 * DTOs for Competency Monitor Overview Dashboard
 */

// Summary of a competency category with averages and trends
export interface CompetencyCategorySummary {
  id: number;
  name: string;
  averageScore: number;
  previousAverageScore: number | null;
  trendDelta: number | null; // Delta vs previous scan for this category
  numStudentsUp: number;
  numStudentsDown: number;
  numStudentsSame: number;
}

// Summary of a scan with category averages
export interface ScanSummary {
  scanId: number;
  label: string;
  date: string;
  categoryAverages: {
    categoryId: number;
    categoryName: string;
    averageScore: number;
  }[];
  overallAverage: number;
  median: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
}

// Student summary for the students tab
export interface StudentCompetencySummary {
  studentId: number;
  name: string;
  className: string | null;
  lastScanDate: string | null;
  lastOverallScore: number | null;
  trendDelta: number | null;
  strongestCategory: string | null;
  weakestCategory: string | null;
}

// Risk student for a specific category
export interface RiskStudentForCategory {
  studentId: number;
  name: string;
  className: string | null;
  categoryId: number;
  categoryName: string;
  lastScore: number | null;
  trendDelta: number | null;
}

// Learning goal summary for the learning goals tab
export interface LearningGoalSummary {
  id: number;
  studentId: number;
  studentName: string;
  className: string | null;
  categoryId: number | null;
  categoryName: string | null;
  goalText: string;
  status: "in_progress" | "achieved" | "not_achieved";
  createdAt: string;
  updatedAt: string;
}

// Reflection summary for the reflections tab
export interface ReflectionSummary {
  id: number;
  studentId: number;
  studentName: string;
  className: string | null;
  categoryId: number | null;
  categoryName: string | null;
  scanId: number;
  scanLabel: string;
  createdAt: string;
  reflectionText: string;
}

// Notable students for the overview
export interface NotableStudent {
  studentId: number;
  name: string;
  className: string | null;
  type: "strong_growth" | "decline" | "low_score";
  trendDelta: number | null;
  score: number | null;
  categoryName: string | null;
}

// Heatmap row for class overview
export interface HeatmapStudentRow {
  studentId: number;
  name: string;
  className: string | null;
  scores: Record<number, number | null>; // categoryId -> score
  scoreDeltas: Record<number, number | null>; // categoryId -> delta vs previous scan
}

// Main overview data response
export interface CompetencyOverviewData {
  // KPI data
  classAverageScore: number | null;
  classTrendDelta: number | null;
  studentsImproved: number;
  studentsDeclined: number;
  totalStudents: number;
  
  // Category summaries for radar/bar charts
  categorySummaries: CompetencyCategorySummary[];
  
  // Scans for time series
  scans: ScanSummary[];
  
  // Heatmap data
  heatmapRows: HeatmapStudentRow[];
  
  // Notable students
  notableStudents: NotableStudent[];
}

// Category detail data
export interface CategoryDetailData {
  category: CompetencyCategorySummary;
  scoreDistribution: {
    score: number;
    count: number;
  }[];
  riskStudents: RiskStudentForCategory[];
  minScore: number | null;
  maxScore: number | null;
}

// Filter options
export interface CompetencyOverviewFilters {
  academicYearId?: number;
  courseId?: number;
  scanRange?: "last_3" | "last_5" | "last_year" | "all";
  categoryId?: number;
  status?: string;
  searchQuery?: string;
}

// Available filter options from the backend
export interface FilterOptions {
  academicYears: { id: number; label: string }[];
  courses: { id: number; name: string }[];
  scans: { id: number; label: string; date: string }[];
  categories: { id: number; name: string }[];
}

// ========== Student Detail Page DTOs ==========

// Category score for a single scan
export interface StudentCategoryScore {
  categoryId: number;
  categoryName: string;
  score: number | null;
}

// Scan data for a single student
export interface StudentScanData {
  scanId: number;
  scanLabel: string;
  scanDate: string;
  overallScore: number | null;
  categoryScores: StudentCategoryScore[];
}

// Student detail data for the individual student page
export interface StudentDetailData {
  studentId: number;
  name: string;
  className: string | null;
  email: string | null;
  
  // Current profile (latest scan)
  currentOverallScore: number | null;
  currentCategoryScores: StudentCategoryScore[];
  trendDelta: number | null;
  strongestCategory: string | null;
  weakestCategory: string | null;
  
  // All scans for this student
  scans: StudentScanData[];
  
  // Learning goals for this student
  learningGoals: LearningGoalSummary[];
  
  // Reflections for this student
  reflections: ReflectionSummary[];
}
