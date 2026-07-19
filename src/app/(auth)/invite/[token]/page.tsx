import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import AcceptInviteForm from "./accept-invite-form";

type InvitationRow = {
  email: string;
  token: string;
  departments?: { name: string } | null;
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("invitations")
    .select("email, token, departments(name)")
    .eq("token", token)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  const invitation = data as InvitationRow | null;
  if (!invitation) notFound();

  const deptName = invitation.departments?.name ?? null;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-ink">
            Dzyga <span className="text-accent">Metrics</span>
          </h1>
          <p className="mt-2 text-sm text-muted">Прийняти запрошення</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 rounded-lg bg-accent-soft px-4 py-3">
            <p className="text-sm text-ink">
              <span className="font-medium">{invitation.email}</span>
            </p>
            {deptName && (
              <p className="text-sm text-muted">Відділ: {deptName}</p>
            )}
          </div>
          <AcceptInviteForm token={token} email={invitation.email} />
        </div>
      </div>
    </div>
  );
}
