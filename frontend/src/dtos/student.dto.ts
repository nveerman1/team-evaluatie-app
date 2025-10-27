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
