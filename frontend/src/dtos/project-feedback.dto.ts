export type ProjectFeedbackRound = {
  id: number;
  project_id: number;
  title: string;
  status: "draft" | "open" | "closed";
  question_count: number;
  response_count: number;
  total_students: number;
  avg_rating?: number;
  project_grade?: number;
  course_name?: string;
  created_at: string;
};

export type ProjectFeedbackQuestion = {
  id: number;
  question_text: string;
  question_type: "rating" | "scale10" | "open";
  order: number;
  is_required: boolean;
};

export type ProjectFeedbackRoundDetail = ProjectFeedbackRound & {
  questions: ProjectFeedbackQuestion[];
  closed_at?: string;
};

export type ProjectFeedbackResults = {
  round: ProjectFeedbackRound;
  questions: Array<
    ProjectFeedbackQuestion & {
      avg_rating?: number;
      rating_distribution?: Record<number, number>;
      open_answers?: string[];
    }
  >;
  response_rate: number;
};

export type ProjectFeedbackSubmission = {
  answers: Array<{
    question_id: number;
    rating_value?: number;
    text_value?: string;
  }>;
};

export type ProjectFeedbackResponse = {
  id: number;
  round_id: number;
  student_id: number;
  submitted_at?: string;
  answers: Array<{
    question_id: number;
    rating_value?: number;
    text_value?: string;
  }>;
};

export type ProjectFeedbackQuestionIn = {
  question_text: string;
  question_type: "rating" | "scale10" | "open";
  order: number;
  is_required: boolean;
};

export type ProjectFeedbackRoundCreate = {
  project_id: number;
  title: string;
  questions?: ProjectFeedbackQuestionIn[];
};

export type ProjectFeedbackRoundUpdate = {
  title?: string;
  questions?: ProjectFeedbackQuestionIn[];
};
