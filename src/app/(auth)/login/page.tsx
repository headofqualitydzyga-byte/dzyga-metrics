import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-ink">
            Dzyga <span className="text-accent">Metrics</span>
          </h1>
          <p className="mt-2 text-sm text-muted">Увійдіть до системи</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
