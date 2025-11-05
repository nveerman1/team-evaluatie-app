export type MyAllocation = {
  allocation_id: number;
  evaluation_id: number;
  reviewee_id: number;
  reviewee_name: string;
  reviewee_email: string;
  is_self: boolean;
  rubric_id: number;
  criterion_ids: number[];
  completed?: boolean;
};

export type Criterion = {
  id: number;
  rubric_id: number;
  name: string;
  weight: number;
  category?: string | null;
  descriptors: Record<string, string>;
};

export type ScoreItem = {
  criterion_id: number;
  score: number;
  comment?: string;
};
