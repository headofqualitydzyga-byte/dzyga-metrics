import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getPreviousWeekStart,
  getCurrentMonthStart,
  formatWeekStart,
  getWeekLabel,
  getMonthLabel,
} from "@/lib/metrics/status";
import { getAccessibleMetricIds, filterByAccess } from "@/lib/metrics/access";
import { isKyivHour } from "@/lib/cron-time";
import type { MetricDefinition } from "@/types/database";

// Every month has exactly one Monday in its final 7 days.
function isLastMondayOfMonth(d: Date): boolean {
  const next = new Date(d);
  next.setDate(d.getDate() + 7);
  return next.getMonth() !== d.getMonth();
}

// Called every Monday at 09:00 via Vercel Cron
export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // The cron fires twice on Monday (see vercel.json) to cover both sides of
  // Kyiv's DST shift — only the firing that actually lands at 9am Kyiv acts.
  if (!isKyivHour(now, 9)) {
    return NextResponse.json({ ok: true, skipped: "not 9am Kyiv" });
  }

  const supabase = createAdminClient();
  const isLastMonday = isLastMondayOfMonth(now);

  const weekStart = formatWeekStart(getPreviousWeekStart());
  const monthStart = formatWeekStart(getCurrentMonthStart());

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  }

  // Get all managers with telegram linked
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: managersRaw } = await (supabase as any)
    .from("profiles")
    .select("id, telegram_id, full_name")
    .eq("role", "manager")
    .not("telegram_id", "is", null);

  const managers = managersRaw as Array<{
    id: string;
    telegram_id: string | null;
    full_name: string | null;
  }> | null;

  if (!managers?.length) {
    return NextResponse.json({ ok: true, notifiedWeekly: 0, notifiedMonthly: 0 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: defsRaw } = await (supabase as any)
    .from("metric_definitions")
    .select("*")
    .eq("is_active", true);
  const allDefs = (defsRaw ?? []) as MetricDefinition[];

  async function sendReminder(chatId: string, text: string) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  }

  let notifiedWeekly = 0;
  let notifiedMonthly = 0;

  for (const manager of managers) {
    const accessibleIds = await getAccessibleMetricIds(supabase, manager.id);
    const accessible = filterByAccess(allDefs, "manager", accessibleIds);

    const hasWeekly = accessible.some((d) => d.frequency === "weekly");
    const hasMonthly = accessible.some((d) => d.frequency === "monthly");

    if (hasWeekly) {
      const { data: subs } = await supabase
        .from("metric_submissions")
        .select("id")
        .eq("profile_id", manager.id)
        .eq("week_start", weekStart)
        .limit(1);

      if (!subs?.length) {
        await sendReminder(
          manager.telegram_id!,
          `📊 Нагадування!\n\nВи ще не здали тижневі метрики за ${getWeekLabel(weekStart)}.\n\n` +
            `Введіть /submit щоб внести показники.`
        );
        notifiedWeekly++;
      }
    }

    if (isLastMonday && hasMonthly) {
      const { data: subs } = await supabase
        .from("metric_submissions")
        .select("id")
        .eq("profile_id", manager.id)
        .eq("week_start", monthStart)
        .limit(1);

      if (!subs?.length) {
        await sendReminder(
          manager.telegram_id!,
          `📊 Нагадування!\n\nВи ще не здали місячні метрики за ${getMonthLabel(monthStart)}.\n\n` +
            `Введіть /submit щоб внести показники.`
        );
        notifiedMonthly++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    notifiedWeekly,
    notifiedMonthly,
    weekStart,
    monthStart,
    isLastMondayOfMonth: isLastMonday,
  });
}
