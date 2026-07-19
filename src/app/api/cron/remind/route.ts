import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentWeekStart, formatWeekStart, getWeekLabel } from "@/lib/metrics/status";

// Called every Monday at 09:00 via Vercel Cron
export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Last week (the one that just ended)
  const currentWeek = getCurrentWeekStart();
  const lastWeek = new Date(currentWeek);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const weekStart = formatWeekStart(lastWeek);

  // Get all managers with telegram linked
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: managersRaw } = await (supabase as any)
    .from("profiles")
    .select("id, telegram_id, full_name, department_id")
    .eq("role", "manager")
    .not("telegram_id", "is", null);

  const managers = managersRaw as Array<{
    id: string;
    telegram_id: string | null;
    full_name: string | null;
    department_id: string | null;
  }> | null;

  if (!managers?.length) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  }

  let notified = 0;

  for (const manager of managers) {
    // Check if they have any submissions for last week
    const { data: subs } = await supabase
      .from("metric_submissions")
      .select("id")
      .eq("profile_id", manager.id)
      .eq("week_start", weekStart)
      .limit(1);

    if (!subs?.length) {
      // Send reminder
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: manager.telegram_id,
          text:
            `📊 Нагадування!\n\nВи ще не здали метрики за ${getWeekLabel(weekStart)}.\n\n` +
            `Введіть /submit щоб внести показники.`,
        }),
      });
      notified++;
    }
  }

  return NextResponse.json({ ok: true, notified, weekStart });
}
