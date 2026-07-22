import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canManageAdmin } from "@/lib/auth";
import DepartmentsClient from "./departments-client";

export default async function DepartmentsPage() {
  const { profile } = await requireProfile();
  if (!canManageAdmin(profile.role)) redirect("/admin/metrics");

  const supabase = await createClient();
  const { data: departments } = await supabase
    .from("departments")
    .select("*")
    .order("sort_order");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Відділи</h1>
          <p className="mt-1 text-sm text-muted">
            Управління відділами компанії
          </p>
        </div>
      </div>
      <DepartmentsClient departments={departments ?? []} />
    </div>
  );
}
