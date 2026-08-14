import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentWeekStart, getCurrentMonthStart, getWeekLabel, formatWeekStart } from "@/lib/metrics/status";
import { getPlanSetterIds } from "@/lib/bot/handlers";
import type { MetricDefinition } from "@/types/database";

// This route is only ever triggered on a Monday (see vercel.json), so a
// date-of-month <= 7 always means "the first Monday of this month".
function isFirstMondayOfMonth(d: Date): boolean {
  return d.getDate() <= 7;
}

// Called every Monday at 09:00 via Vercel Cron — nudges the designated
// plan-setter to (re-)enter plan_value for every plan_recurring metric
// that's still stale for the current period.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const planSetterIds = getPlanSetterIds();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!planSetterIds.length || !botToken) {
    return NextResponse.json({ ok: true, skipped: "PLAN_SETTER_TELEGRAM_ID or TELEGRAM_BOT_TOKEN not set" });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const weekStart = getCurrentWeekStart();
  const monthStart = getCurrentMonthStart();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: defsRaw } = await (supabase as any)
    .from("metric_definitions")
    .select("*, departments(name)")
    .eq("plan_recurring", true)
    .eq("is_active", true)
    .order("sort_order");

  const defs = (defsRaw ?? []) as Array<MetricDefinition & { departments: { name: string } | null }>;

  const isStale = (d: MetricDefinition, periodStart: Date) =>
    !d.plan_value_updated_at || new Date(d.plan_value_updated_at) < periodStart;

  const pending = [
    ...defs.filter((d) => d.frequency === "weekly" && isStale(d, weekStart)),
    ...(isFirstMondayOfMonth(now)
      ? defs.filter((d) => d.frequency === "monthly" && isStale(d, monthStart))
      : []),
  ];

  if (!pending.length) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  const byDept = new Map<string, typeof pending>();
  for (const d of pending) {
    const deptName = d.departments?.name ?? "—";
    byDept.set(deptName, [...(byDept.get(deptName) ?? []), d]);
  }

  const sections = [...byDept.entries()]
    .map(([deptName, items]) => {
      const lines = items
        .map((d) => `  • ${d.name}${d.plan_value != null ? ` (зараз: ${d.plan_value} ${d.unit})` : ""}`)
        .join("\n");
      return `*${deptName}*\n${lines}`;
    })
    .join("\n\n");

  const text =
    `📌 *Час оновити планові значення!*\n\n` +
    `Тиждень: ${getWeekLabel(formatWeekStart(weekStart))}\n\n` +
    `${sections}\n\n` +
    `Введіть /planvalues щоб внести планові значення.`;

  for (const planSetterId of planSetterIds) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: planSetterId, text, parse_mode: "Markdown" }),
    });
  }

  return NextResponse.json({ ok: true, notified: pending.length, recipients: planSetterIds.length });
}
