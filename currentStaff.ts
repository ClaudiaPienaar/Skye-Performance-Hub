import { createClient } from "@/lib/supabase/server";
import type { Staff } from "@/lib/types";

export type StaffContext = {
  userEmail: string;
  staff: Staff;
  isManager: boolean;
};

/**
 * Resolves the signed-in Supabase user to their `staff` row.
 *
 * Returns:
 *  - null                → nobody is signed in (caller should redirect to /login)
 *  - { notInvited: true } → signed in, but no staff row has this email yet
 *                           (an admin has not added them — this is the
 *                           "sign-in doesn't by itself grant access" rule)
 *  - StaffContext          → signed in and matched; use .staff for display
 *                           and .isManager to decide which nav items show
 *
 * All of the actual data access this guards is still enforced again by
 * Postgres row-level security — this helper only decides what the UI shows.
 */
export async function getStaffContext(): Promise<StaffContext | { notInvited: true } | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .ilike("email", user.email)
    .maybeSingle();

  if (!staff) return { notInvited: true };

  const { count } = await supabase
    .from("staff")
    .select("id", { count: "exact", head: true })
    .eq("manager_id", staff.id);

  return {
    userEmail: user.email,
    staff: staff as Staff,
    isManager: (count ?? 0) > 0,
  };
}

export function isNotInvited(
  ctx: Awaited<ReturnType<typeof getStaffContext>>
): ctx is { notInvited: true } {
  return !!ctx && "notInvited" in ctx;
}
