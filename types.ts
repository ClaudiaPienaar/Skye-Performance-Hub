// Hand-written types matching supabase/schema.sql. If the schema changes,
// update this file to match (or generate with `supabase gen types typescript`
// once you have the Supabase CLI linked to your project).

export type Dimension = {
  name: string;
  dnm: string;
  good: string;
  better: string;
  best: string;
};

export type Scorecard = {
  key: string;
  title: string;
  note: string | null;
  dimensions: Dimension[];
  standards: string[];
  sort_order: number;
};

export type Department = {
  id: string;
  name: string;
  sort_order: number;
};

export type AppRole = "staff" | "manager" | "exec";

export type Staff = {
  id: string;
  name: string;
  role_title: string;
  department_id: string | null;
  manager_id: string | null;
  scorecard_key: string | null;
  email: string | null;
  app_role: AppRole;
  is_admin: boolean;
  created_at: string;
};

export type Cycle = {
  id: string;
  label: string;
  due_date: string | null;
  sort_order: number;
};

export type ScoreMap = Record<number, number>; // dimension index -> 1..4
export type StandardsCheck = Record<number, "met" | "notmet">; // standard index -> status

export type SelfRating = {
  staff_id: string;
  cycle_id: string;
  scores: ScoreMap;
  standards_check: StandardsCheck;
  comment: string | null;
  submitted_at: string | null;
  updated_at: string;
};

export type ManagerReview = {
  staff_id: string;
  cycle_id: string;
  scores: ScoreMap;
  standards_check: StandardsCheck;
  comment: string | null;
  overall: number | null;
  published: boolean;
  submitted_at: string | null;
  updated_at: string;
  reviewed_by: string | null;
};

export type Feedback = {
  id: string;
  from_staff_id: string;
  to_staff_id: string;
  type: "Recognition" | "Constructive" | "Peer note";
  message: string;
  created_at: string;
};

// Minimal Supabase Database type covering the tables/views this app queries.
// Using `any` for Row/Insert/Update keeps this file short; the app code
// still works against the concrete types above wherever it matters.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
