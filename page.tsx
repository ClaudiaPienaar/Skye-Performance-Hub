import { redirect } from "next/navigation";
import { getStaffContext, isNotInvited } from "@/lib/currentStaff";

export default async function RootPage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/login");
  if (isNotInvited(ctx)) redirect("/not-invited");
  redirect(ctx.staff.is_admin ? "/dashboard" : "/myperf");
}
