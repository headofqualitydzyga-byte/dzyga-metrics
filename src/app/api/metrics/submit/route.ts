import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { calcStatus } from "@/lib/metrics/status";
import type { MetricDefinition } from "@/types/database";

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireProfile();
    const body = await req.json();
    const { entries } = body as {
      entries: Array<{
        metric_definition_id: string;
        value: number;
        comment?: string | null;
        week_start: string;
      }>;
    };

    const supabase = await createClient();

    const upserts = entries.map((e) => ({
      profile_id: profile.id,
      metric_definition_id: e.metric_definition_id,
      week_start: e.week_start,
      value: e.value,
      comment: e.comment ?? null,
      submitted_via: "web" as const,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("metric_submissions").upsert(upserts, {
      onConflict: "profile_id,metric_definition_id,week_start",
    });

    if (error) {
      return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
    }

    // Check for critical metrics and notify admins via Telegram
    const metricIds = entries.map((e) => e.metric_definition_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: defsRaw } = await (supabase as any)
      .from("metric_definitions")
      .select("*")
      .in("id", metricIds);

    const defs = defsRaw as MetricDefinition[] | null;

    if (defs) {
      const criticals = entries.filter((e) => {
        const def = defs.find((d) => d.id === e.metric_definition_id);
        return def && calcStatus(def, e.value) === "critical";
      });

      if (criticals.length > 0 && defs.length > 0) {
        const adminSupabase = createAdminClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: adminsRaw } = await (adminSupabase as any)
          .from("profiles")
          .select("telegram_id")
          .in("role", ["admin", "viewer"])
          .not("telegram_id", "is", null);

        const admins = adminsRaw as Array<{ telegram_id: string }> | null;

        if (admins?.length) {
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          if (botToken) {
            const names = criticals
              .map((e) => {
                const def = defs.find((d) => d.id === e.metric_definition_id);
                return def ? `• ${def.name}: ${e.value} ${def.unit}` : "";
              })
              .filter(Boolean)
              .join("\n");

            const text = `⚠️ *Критичні метрики*\n${names}`;

            await Promise.allSettled(
              admins.map((a) =>
                fetch(
                  `https://api.telegram.org/bot${botToken}/sendMessage`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: a.telegram_id,
                      text,
                      parse_mode: "Markdown",
                    }),
                  }
                )
              )
            );
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
