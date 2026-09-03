export type ReviewResult = "Remembered" | "Forgot";

export interface Expression {
  id: string;
  text: string; // Expression (Title)
  meaning: string; // Meaning
  example: string; // Original Example
  source: string; // Source ("" if absent)
  lastReview: string | null; // "YYYY-MM-DD" or null
  reviewCount: number; // Review Count
  reviewDue: string; // "YYYY-MM-DD"
  level: number; // Review Level 0..5
  added: string; // created_time date, "YYYY-MM-DD"
}

export interface ReviewExample {
  id: string;
  sentence: string; // Example (Title)
  reviewDate: string; // "YYYY-MM-DD"
  result: ReviewResult; // Result
  expressionId: string; // relation target
}

// What computeNextReview returns / persists to Notion.
export interface ScheduleUpdate {
  level: number;
  reviewCount: number;
  reviewDue: string; // "YYYY-MM-DD"
  lastReview: string; // "YYYY-MM-DD"
}

export interface Stats {
  total: number; // statTotal
  sentences: number; // statSentences (count of review examples)
  rememberedRate: number; // 0..1 over all completed reviews
  needsAttention: Array<{
    id: string;
    text: string;
    forgot: number;
    remembered: number;
    forgotRate: number;
  }>;
  last14Days: number[]; // length 14, oldest -> newest, review counts
}
