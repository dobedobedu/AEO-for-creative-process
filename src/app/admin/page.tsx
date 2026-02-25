import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/tenant/db";

/**
 * Admin entry route.
 * - New tenant: /admin -> /admin/setup
 * - Existing tenant: /admin -> /admin/matrix
 */
export default async function AdminIndexPage() {
  const setupComplete = await isSetupComplete();
  redirect(setupComplete ? "/admin/matrix" : "/admin/setup");
}

