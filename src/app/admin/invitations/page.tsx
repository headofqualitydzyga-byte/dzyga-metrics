import { createClient } from "@/lib/supabase/server";
import InvitationsClient from "./invitations-client";

export default async function InvitationsPage() {
  const supabase = await createClient();

  const [{ data: invitations }, { data: departments }] = await Promise.all([
    supabase
      .from("invitations")
      .select("*, departments(name)")
      .order("created_at", { ascending: false }),
    supabase.from("departments").select("id, name").order("sort_order"),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink">Запрошення</h1>
        <p className="mt-1 text-sm text-muted">
          Запрошення нових співробітників до системи
        </p>
      </div>
      <InvitationsClient
        invitations={invitations ?? []}
        departments={departments ?? []}
      />
    </div>
  );
}
