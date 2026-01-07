// Student-specific DTOs for the student flow

import { Evaluation } from "./evaluation.dto";
import { MyAllocation } from "./allocation.dto";

/**
 * Student evaluation with progress tracking
 */
export type StudentEvaluation = Evaluation & {
  progress: number; // 0-100 percentage
  selfCompleted: boolean;
  peersCompleted: number; // number of peers completed
  peersTotal: number; // total number of peers to review
  reflectionCompleted: boolean;
  canStartPeers: boolean; // false if self-eval not done
  canSubmitReflection: boolean; // depends on evaluation settings
  nextStep?: number; // 1-4, the first incomplete step
};

/**
 * Peer review allocation with completion status
 */
export type PeerAllocation = MyAllocation & {
  completed: boolean;
  canEdit: boolean; // false if evaluation is closed
};

/**
 * Student dashboard summary
 */
export type StudentDashboard = {
  openEvaluations: StudentEvaluation[];
  completedEvaluations: number;
  pendingReviews: number;
  pendingReflections: number;
  hasAnyEvaluations: boolean; // true if student has at least one evaluation (any status)
  canReviewPeers: boolean; // false if student needs to complete self-assessment first
  needsSelfAssessment: boolean; // true if student has not completed self-assessment yet
  openScans: number; // number of open competency scans
  newAssessments: number; // number of new project assessments
  userName?: string; // student name
  userClass?: string; // student class
};

/**
 * Student result for a single evaluation
 */
export type StudentResult = {
  evaluation_id: number;
  evaluation_title: string;
  user_id: number;
  user_name: string;
  final_grade?: number; // the actual final grade
  suggested_grade?: number;
  group_grade?: number;
  gcf?: number; // Group Contribution Factor
  spr?: number; // Self-Peer Ratio
  teacher_comment?: string;
  peer_feedback: ReceivedFeedback[];
  self_feedback: ReceivedFeedback[];
  reflection?: {
    text: string;
    submitted_at?: string;
    editable: boolean;
  };
  criteria_summary: CriteriaSummary[];
};

/**
 * Received feedback from a peer or self
 */
export type ReceivedFeedback = {
  reviewer_id?: number; // undefined for anonymous
  reviewer_name: string;
  is_self: boolean;
  comments: FeedbackComment[];
  avg_score?: number; // average across criteria
};

/**
 * Individual feedback comment per criterion
 */
export type FeedbackComment = {
  criterion_id: number;
  criterion_name: string;
  score: number;
  text: string;
};

/**
 * Summary of scores per criterion
 */
export type CriteriaSummary = {
  criterion_id: number;
  criterion_name: string;
  self_score?: number;
  peer_avg_score?: number;
  weight: number;
};

/**
 * Reflection submission
 */
export type ReflectionSubmit = {
  text: string;
  submit: boolean; // true = final submit, false = save draft
};

/**
 * Wizard validation state
 */
export type WizardValidation = {
  step: number;
  isValid: boolean;
  errors: string[];
};

// ============ Growth Page DTOs ============

/**
 * OMZA scores (Organiseren, Meedoen, Zelfvertrouwen, Autonomie)
 */
export type OMZAScores = {
  organiseren: number;
  meedoen: number;
  zelfvertrouwen: number;
  autonomie: number;
};

/**
 * Scan type for competency scans
 */
export type ScanType = "start" | "tussen" | "eind" | "los";

/**
 * Summary of a competency scan for the growth page
 */
export type GrowthScanSummary = {
  id: string;
  title: string;
  date: string;
  type: ScanType;
  omza: OMZAScores;
  gcf: number;
  has_reflection: boolean;
  goals_linked: number;
};

/**
 * Category score for competency profile
 */
export type GrowthCategoryScore = {
  name: string;
  value: number; // 1-5 scale
};

/**
 * Goal status type
 */
export type GrowthGoalStatus = "active" | "completed";

/**
 * Goal for the growth page
 */
export type GrowthGoal = {
  id: string;
  title: string;
  status: GrowthGoalStatus;
  related_competencies: string[];
  progress: number; // 0-100
};

/**
 * Reflection for the growth page
 */
export type GrowthReflection = {
  id: string;
  date: string;
  scan_title: string;
  snippet: string;
};

/**
 * Individual competency score with most recent assessment
 */
export type GrowthCompetencyScore = {
  competency_id: number;
  competency_name: string;
  category_name: string | null;
  most_recent_score: number | null;
  window_id: number | null;
  window_title: string | null;
  scan_date: string | null;
};

/**
 * Complete student growth data from the API
 */
export type StudentGrowthData = {
  scans: GrowthScanSummary[];
  competency_profile: GrowthCategoryScore[];
  competency_scores: GrowthCompetencyScore[];
  goals: GrowthGoal[];
  reflections: GrowthReflection[];
  ai_summary: string | null;
};

// ============ Overview Tab DTOs ============

/**
 * Learning goal for the overview tab
 */
export type OverviewLearningGoal = {
  id: string;
  title: string;
  status: "actief" | "afgerond";
  since?: string;
  related?: string;
};

/**
 * Reflection for the overview tab
 */
export type OverviewReflection = {
  id: string;
  title: string;
  type: string;
  date: string;
  text?: string; // Optional full reflection text
};

/**
 * Project result for the overview tab
 */
export type OverviewProjectResult = {
  id: string;
  project: string;
  meta?: string;
  opdrachtgever?: string;
  periode?: string;
  eindcijfer?: number;
  proces?: number;
  eindresultaat?: number;
  communicatie?: number;
};

/**
 * Competency profile category score for the overview tab
 */
export type OverviewCompetencyProfile = {
  category: string;
  value: number;
};

/**
 * Complete overview data for the student dashboard
 */
export type StudentOverviewData = {
  scans: GrowthScanSummary[];
  competencyProfile: OverviewCompetencyProfile[];
  learningGoals: OverviewLearningGoal[];
  reflections: OverviewReflection[];
  projectResults: OverviewProjectResult[];
};

// ============ Scan Selector DTOs ============

/**
 * Scan summary for dropdown list
 */
export type ScanListItem = {
  id: string;
  title: string;
  date: string;
  type: string; // start, tussen, eind, los
};

/**
 * Category score for radar chart
 */
export type RadarCategoryScore = {
  category_id: number;
  category_name: string;
  average_score: number;
  count: number; // Number of competencies in this category
};

/**
 * Complete radar data for a specific scan
 */
export type ScanRadarData = {
  scan_id: string;
  scan_label: string;
  created_at: string;
  categories: RadarCategoryScore[];
  overall_avg: number | null;
};
