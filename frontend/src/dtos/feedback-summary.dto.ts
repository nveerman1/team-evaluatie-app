export type FeedbackSummaryResponse = {
  student_id: number;
  student_name: string;
  summary_text: string;
  generation_method: "ai" | "fallback" | "empty";
  feedback_count: number;
  cached: boolean;
};

export type FeedbackQuote = {
  text: string;
  criterion_id?: number | null;
};

export type FeedbackQuotesResponse = {
  quotes: FeedbackQuote[];
  count: number;
};
