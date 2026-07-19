import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export async function requireProfile(): Promise<{
  user: User;
  profile: Profile;
  email: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return { user: user as User, profile: profile as Profile, email: user.email as string };
}

export function canSeeAllDepartments(role: UserRole) {
  return role === "admin" || role === "viewer";
}

export function canManageAdmin(role: UserRole) {
  return role === "admin";
}
