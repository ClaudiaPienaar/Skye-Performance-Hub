"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStaffContext, isNotInvited } from "@/lib/currentStaff";
import type { ScoreMap, StandardsCheck } from "@/lib/types";

function parseScores(formData: FormData, prefix: string, count: number): ScoreMap {
  const out: ScoreMap = {};
  for (let i = 0; i < count; i++) {
    const v = formData.get(`${prefix}${i}`);
    if (typeof v === "string" && v) out[i] = Number(v);
  }
  return out;
}

function parseStandardsCheck(formData: FormData, count: number): StandardsCheck {
  const out: StandardsCheck = {};
  for (let i = 0; i < count; i++) {
    const v = formData.get(`std${i}`);
    if (v === "met" || v === "notmet") out[i] = v;
  }
  return out;
}

/** Staff member submits/updates their own self-rating for a cycle. */
export async function submitSelfRating(formData: FormData) {
  const ctx = await getStaffContext();
  if (!ctx || isNotInvited(ctx)) throw new Error("Not signed in.");

  const cycleId = String(formData.get("cycleId"));
  const dimCount = Number(formData.get("dimCount") || 0);
  const comment = String(formData.get("comment") || "");
  const scores = parseScores(formData, "dim", dimCount);

  const supabase = createClient();
  const { error } = await supabase.from("self_ratings").upsert(
    {
      staff_id: ctx.staff.id,
      cycle_id: cycleId,
      scores,
      comment,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "staff_id,cycle_id" }
  );
  if (error) throw new Error(error.message);

  revalidatePath("/myperf");
}

/** Manager (or admin) writes/updates a review for one of their reports, optionally publishing it. */
export async function submitManagerReview(formData: FormData) {
  const ctx = await getStaffContext();
  if (!ctx || isNotInvited(ctx)) throw new Error("Not signed in.");

  const targetStaffId = String(formData.get("staffId"));
  const cycleId = String(formData.get("cycleId"));
  const dimCount = Number(formData.get("dimCount") || 0);
  const stdCount = Number(formData.get("stdCount") || 0);
  const comment = String(formData.get("comment") || "");
  const publish = formData.get("publish") === "true";
  const scores = parseScores(formData, "dim", dimCount);
  const standardsCheck = parseStandardsCheck(formData, stdCount);

  const supabase = createClient();
  const { error } = await supabase.from("manager_reviews").upsert(
    {
      staff_id: targetStaffId,
      cycle_id: cycleId,
      scores,
      standards_check: standardsCheck,
      comment,
      published: publish,
      submitted_at: new Date().toISOString(),
      reviewed_by: ctx.staff.id,
    },
    { onConflict: "staff_id,cycle_id" }
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/myteam/${targetStaffId}`);
  revalidatePath("/myteam");
  revalidatePath("/dashboard");
}

export async function addFeedback(formData: FormData) {
  const ctx = await getStaffContext();
  if (!ctx || isNotInvited(ctx)) throw new Error("Not signed in.");

  const toStaffId = String(formData.get("toStaffId"));
  const type = String(formData.get("type"));
  const message = String(formData.get("message") || "").trim();
  if (!message) return;

  const supabase = createClient();
  const { error } = await supabase.from("feedback").insert({
    from_staff_id: ctx.staff.id,
    to_staff_id: toStaffId,
    type,
    message,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/feedback");
}

export async function setCycleDueDate(formData: FormData) {
  const cycleId = String(formData.get("cycleId"));
  const dueDate = String(formData.get("dueDate") || "");

  const supabase = createClient();
  const { error } = await supabase
    .from("cycles")
    .update({ due_date: dueDate || null })
    .eq("id", cycleId);
  if (error) throw new Error(error.message);

  revalidatePath("/cycles");
  revalidatePath("/dashboard");
  revalidatePath("/myperf");
}

/** Staff Admin: add a new staff member. Admin-only — enforced by RLS. */
export async function createStaffMember(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const roleTitle = String(formData.get("roleTitle") || "").trim();
  const departmentId = String(formData.get("departmentId") || "") || null;
  const managerId = String(formData.get("managerId") || "") || null;
  const scorecardKey = String(formData.get("scorecardKey") || "") || null;
  const email = String(formData.get("email") || "").trim() || null;
  const isAdmin = formData.get("isAdmin") === "on";

  if (!name || !roleTitle) throw new Error("Name and role title are required.");

  const supabase = createClient();
  const { error } = await supabase.from("staff").insert({
    name,
    role_title: roleTitle,
    department_id: departmentId,
    manager_id: managerId,
    scorecard_key: scorecardKey,
    email,
    is_admin: isAdmin,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/staff");
}

/** Staff Admin: edit an existing staff member's details, including their name. */
export async function updateStaffMember(formData: FormData) {
  const id = String(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const roleTitle = String(formData.get("roleTitle") || "").trim();
  const departmentId = String(formData.get("departmentId") || "") || null;
  const managerId = String(formData.get("managerId") || "") || null;
  const scorecardKey = String(formData.get("scorecardKey") || "") || null;
  const email = String(formData.get("email") || "").trim() || null;
  const isAdmin = formData.get("isAdmin") === "on";

  if (!name || !roleTitle) throw new Error("Name and role title are required.");

  const supabase = createClient();
  const { error } = await supabase
    .from("staff")
    .update({
      name,
      role_title: roleTitle,
      department_id: departmentId,
      manager_id: managerId,
      scorecard_key: scorecardKey,
      email,
      is_admin: isAdmin,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/staff");
}

export async function deleteStaffMember(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createClient();
  const { error } = await supabase.from("staff").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/staff");
}
