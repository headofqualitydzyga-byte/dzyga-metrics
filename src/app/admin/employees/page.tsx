import { createClient } from "@/lib/supabase/server";
import EmployeesClient from "./employees-client";

export default async function EmployeesPage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: departments }, { data: invitations }] =
    await Promise.all([
      supabase.from("profiles").select("*, departments(name)").order("created_at"),
      supabase.from("departments").select("id, name").order("sort_order"),
      supabase
        .from("invitations")
        .select("*, departments(name)")
        .order("created_at", { ascending: false }),
    ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink">Співробітники</h1>
        <p className="mt-1 text-sm text-muted">
          Управління доступом, ролями та запрошеннями
        </p>
      </div>
      <EmployeesClient
        profiles={profiles ?? []}
        departments={departments ?? []}
        invitations={invitations ?? []}
      />
    </div>
  );
}
