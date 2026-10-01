import { createClient } from "@/lib/supabase/server";
import type { Cycle, Department, Scorecard, Staff } from "@/lib/types";

export async function getDepartments(): Promise<Department[]> {
  const supabase = createClient();
  const { data } = await supabase.from("departments").select("*").order("sort_order");
  return (data as Department[]) || [];
}

export async function getScorecards(): Promise<Scorecard[]> {
  const supabase = createClient();
  const { data } = await supabase.from("scorecards").select("*").order("sort_order");
  return (data as Scorecard[]) || [];
}

export async function getScorecard(key: string): Promise<Scorecard | null> {
  const supabase = createClient();
  const { data } = await supabase.from("scorecards").select("*").eq("key", key).maybeSingle();
  return (data as Scorecard) || null;
}

export async function getCycles(): Promise<Cycle[]> {
  const supabase = createClient();
  const { data } = await supabase.from("cycles").select("*").order("sort_order");
  return (data as Cycle[]) || [];
}

export async function getAllStaff(): Promise<Staff[]> {
  const supabase = createClient();
  const { data } = await supabase.from("staff").select("*").order("name");
  return (data as Staff[]) || [];
}

export async function getStaffById(id: string): Promise<Staff | null> {
  const supabase = createClient();
  const { data } = await supabase.from("staff").select("*").eq("id", id).maybeSingle();
  return (data as Staff) || null;
}

export async function getReports(managerId: string): Promise<Staff[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("staff")
    .select("*")
    .eq("manager_id", managerId)
    .order("name");
  return (data as Staff[]) || [];
}
