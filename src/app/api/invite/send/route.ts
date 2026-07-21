import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireProfile, canManageAdmin } from "@/lib/auth";
import { sendInvitationEmail } from "@/lib/email/mailer";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { profile } = await requireProfile();
  if (!canManageAdmin(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { email, role, department_id } = body as {
      email: string;
      role: string;
      department_id?: string;
    };

    if (!email || !role) {
      return NextResponse.json({ error: "email та role обов'язкові" }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const token = crypto.randomBytes(32).toString("hex");
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: inviteError } = await (adminSupabase as any).from("invitations").insert({
      email,
      role,
      department_id: department_id || null,
      token,
      invited_by: profile.id,
      expires_at,
    });

    if (inviteError) {
      return NextResponse.json({ error: (inviteError as { message: string }).message }, { status: 500 });
    }

    let departmentName: string | undefined;
    if (department_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: dept } = await (adminSupabase as any)
        .from("departments")
        .select("name")
        .eq("id", department_id)
        .single();
      departmentName = (dept as { name: string } | null)?.name;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await sendInvitationEmail({
      to: email,
      inviteUrl: `${appUrl}/invite/${token}`,
      role,
      departmentName,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
