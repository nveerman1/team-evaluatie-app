export type FeedbackSummaryResponse = {
  student_id: number;
  student_name: string;
  summary_text: string;
  generation_method: "ai" | "fallback" | "empty";
  feedback_count: number;
  cached: boolean;
};

export type JobStatusResponse = {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  student_id: number;
  evaluation_id: number;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  result?: {
    summary_text: string;
    generation_method: string;
    feedback_count: number;
  } | null;
  error_message?: string | null;
};

export type BatchQueueResponse = {
  evaluation_id: number;
  total_students: number;
  queued: number;
  already_queued: number;
  failed: number;
  results: Array<{
    student_id: number;
    job_id?: string;
    status: string;
    error?: string;
  }>;
};

export type FeedbackQuote = {
  text: string;
  criterion_id?: number | null;
};

export type FeedbackQuotesResponse = {
  quotes: FeedbackQuote[];
  count: number;
};
