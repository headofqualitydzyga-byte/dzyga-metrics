import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "token та password обов'язкові" }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invitationRaw } = await (adminSupabase as any)
      .from("invitations")
      .select("*")
      .eq("token", token)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    const invitation = invitationRaw as {
      email: string;
      role: string;
      department_id: string | null;
    } | null;

    if (!invitation) {
      return NextResponse.json(
        { error: "Запрошення не знайдено або вже використано" },
        { status: 404 }
      );
    }

    // Create Supabase Auth user
    const { data: authData, error: authError } =
      await adminSupabase.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
      });

    if (authError) {
      // User may already exist — try to update password instead
      if (authError.message.includes("already registered")) {
        const { data: users } = await adminSupabase.auth.admin.listUsers();
        const existing = users.users.find((u) => u.email === invitation.email);
        if (!existing) {
          return NextResponse.json({ error: authError.message }, { status: 400 });
        }
        await adminSupabase.auth.admin.updateUserById(existing.id, { password });
        // Update profile role/dept
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminSupabase as any).from("profiles").upsert({
          id: existing.id,
          email: invitation.email,
          role: invitation.role as "admin" | "manager" | "viewer",
          department_id: invitation.department_id,
        });
      } else {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    } else {
      // New user — update profile with role and dept (trigger creates the profile)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminSupabase as any).from("profiles").upsert({
        id: authData.user.id,
        email: invitation.email,
        role: invitation.role as "admin" | "manager" | "viewer",
        department_id: invitation.department_id,
      });
    }

    // Mark invitation as accepted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any)
      .from("invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("token", token);

    // Sign in automatically
    const { data: session, error: signInError } =
      await adminSupabase.auth.signInWithPassword({
        email: invitation.email,
        password,
      });

    if (signInError || !session.session) {
      return NextResponse.json({ ok: true, redirect: "/login" });
    }

    return NextResponse.json({
      ok: true,
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
