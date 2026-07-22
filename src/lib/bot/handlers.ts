import { Bot, Context, session, SessionFlavor, StorageAdapter } from "grammy";
import { createAdminClient } from "@/lib/supabase/server";
import { calcStatus, getCurrentWeekStart, formatWeekStart, getWeekLabel } from "@/lib/metrics/status";
import {
  weekPickerKeyboard,
  confirmKeyboard,
  booleanKeyboard,
  metricPickerKeyboard,
} from "./keyboards";
import type { MetricDefinition } from "@/types/database";

interface SubmitSession {
  weekStart?: string;
  metrics?: MetricDefinition[];
  values?: Record<string, number>;
  existing?: Record<string, number>;
  awaitingValue?: string | null;
}

type MyContext = Context & SessionFlavor<SubmitSession>;

// grammy's default in-memory session store doesn't survive across
// serverless invocations. Persist sessions in Supabase instead so a
// multi-step flow (e.g. /submit) keeps its state between messages.
function createSupabaseSessionStorage(): StorageAdapter<SubmitSession> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  return {
    async read(key) {
      const { data } = await supabase
        .from("bot_sessions")
        .select("data")
        .eq("id", key)
        .single();
      return (data?.data as SubmitSession | undefined) ?? undefined;
    },
    async write(key, value) {
      await supabase
        .from("bot_sessions")
        .upsert({ id: key, data: value, updated_at: new Date().toISOString() });
    },
    async delete(key) {
      await supabase.from("bot_sessions").delete().eq("id", key);
    },
  };
}

export function createBot(token: string) {
  const bot = new Bot<MyContext>(token);

  bot.use(
    session({
      initial: (): SubmitSession => ({}),
      storage: createSupabaseSessionStorage(),
    })
  );

  // /start
  bot.command("start", async (ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;
    const telegramId = String(ctx.from?.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, department_id, departments(name)")
      .eq("telegram_id", telegramId)
      .single();

    if (!profile) {
      await ctx.reply(
        "👋 Вітаємо!\n\nВаш Telegram не прив'язано до системи.\nЗверніться до адміністратора для прив'язки вашого акаунту."
      );
      return;
    }

    const dept = profile.departments as { name: string } | null;
    await ctx.reply(
      `👋 Привіт, ${profile.full_name ?? profile.email}!\n\n` +
        `📌 Відділ: ${dept?.name ?? "—"}\n\n` +
        `Доступні команди:\n` +
        `/submit — ввести метрики за тиждень\n` +
        `/status — перевірити статус за поточний тиждень\n` +
        `/help — допомога`
    );
  });

  // /help
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "📋 *Команди:*\n\n" +
        "/submit — ввести метрики за тиждень\n" +
        "/status — перевірити статус за поточний тиждень\n" +
        "/start — початок\n\n" +
        "Дані зберігаються в систему Dzyga Metrics.",
      { parse_mode: "Markdown" }
    );
  });

  // /status
  bot.command("status", async (ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;
    const telegramId = String(ctx.from?.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, department_id")
      .eq("telegram_id", telegramId)
      .single();

    if (!profile) {
      await ctx.reply("Ваш Telegram не прив'язано. Зверніться до адміністратора.");
      return;
    }

    const weekStart = formatWeekStart(getCurrentWeekStart());
    const { data: metricsRaw } = await supabase
      .from("metric_definitions")
      .select("*")
      .eq("department_id", profile.department_id)
      .eq("is_active", true)
      .order("sort_order");

    const metrics = metricsRaw as MetricDefinition[] | null;

    if (!metrics?.length) {
      await ctx.reply("Метрики для вашого відділу не налаштовано.");
      return;
    }

    const { data: subsRaw } = await supabase
      .from("metric_submissions")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("week_start", weekStart);

    const subs = subsRaw as Array<{ metric_definition_id: string; value: number }> | null;

    const lines = metrics.map((m) => {
      const sub = subs?.find((s) => s.metric_definition_id === m.id);
      const icon = sub ? "✅" : "⬜";
      return `${icon} ${m.name}${sub ? `: ${sub.value} ${m.unit}` : ""}`;
    });

    await ctx.reply(
      `📊 *Статус за ${getWeekLabel(weekStart)}:*\n\n${lines.join("\n")}`,
      { parse_mode: "Markdown" }
    );
  });

  // /submit
  bot.command("submit", async (ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;
    const telegramId = String(ctx.from?.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, department_id")
      .eq("telegram_id", telegramId)
      .single();

    if (!profile) {
      await ctx.reply("Ваш Telegram не прив'язано. Зверніться до адміністратора.");
      return;
    }

    const { data: metricsData } = await supabase
      .from("metric_definitions")
      .select("*")
      .eq("department_id", profile.department_id)
      .eq("is_active", true)
      .order("sort_order");

    const metrics = metricsData as MetricDefinition[] | null;

    if (!metrics?.length) {
      await ctx.reply("Метрики для вашого відділу не налаштовано.");
      return;
    }

    ctx.session.metrics = metrics;
    ctx.session.values = {};
    ctx.session.existing = {};
    ctx.session.awaitingValue = null;

    await ctx.reply(
      "📅 За який тиждень вводимо метрики?",
      { reply_markup: weekPickerKeyboard() }
    );
  });

  // Week picker callback — loads already-saved values, then shows the metric picker
  bot.callbackQuery(/^week:(.+)$/, async (ctx) => {
    const weekStart = ctx.match[1];
    ctx.session.weekStart = weekStart;
    ctx.session.values = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;
    const telegramId = String(ctx.from?.id);
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("telegram_id", telegramId)
      .single();

    const existing: Record<string, number> = {};
    if (profile) {
      const { data: subsRaw } = await supabase
        .from("metric_submissions")
        .select("metric_definition_id, value")
        .eq("profile_id", profile.id)
        .eq("week_start", weekStart);
      for (const s of (subsRaw ?? []) as Array<{
        metric_definition_id: string;
        value: number;
      }>) {
        existing[s.metric_definition_id] = s.value;
      }
    }
    ctx.session.existing = existing;

    await ctx.answerCallbackQuery();
    await showMetricPicker(ctx, { edit: true });
  });

  // Metric picker: user chose which metric to enter/fix
  bot.callbackQuery(/^pick:(.+)$/, async (ctx) => {
    const metricId = ctx.match[1];
    const metric = ctx.session.metrics?.find((m) => m.id === metricId);
    if (!metric) {
      await ctx.answerCallbackQuery("Метрику не знайдено");
      return;
    }
    await ctx.answerCallbackQuery();

    if (metric.value_type === "boolean") {
      await ctx.editMessageText(`*${metric.name}*\n\nВиконано?`, {
        parse_mode: "Markdown",
        reply_markup: booleanKeyboard(metric.id),
      });
    } else {
      ctx.session.awaitingValue = metricId;
      const current =
        ctx.session.values?.[metricId] ?? ctx.session.existing?.[metricId];
      await ctx.editMessageText(
        `*${metric.name}*\n\nВведіть значення (${metric.unit})` +
          (current !== undefined ? `\nПоточне: ${current}` : ""),
        { parse_mode: "Markdown" }
      );
    }
  });

  // Boolean answer callback
  bot.callbackQuery(/^bool:([^:]+):(\d+)$/, async (ctx) => {
    const [, metricId, valueStr] = ctx.match;
    const value = parseInt(valueStr);
    ctx.session.values = { ...(ctx.session.values ?? {}), [metricId]: value };
    await ctx.answerCallbackQuery(value === 100 ? "✅ Записано: Так" : "❌ Записано: Ні");
    await showMetricPicker(ctx, { edit: true });
  });

  // Confirm callback
  bot.callbackQuery(/^confirm:(.+)$/, async (ctx) => {
    const weekStart = ctx.match[1];
    const values = ctx.session.values ?? {};

    if (Object.keys(values).length === 0) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText("Немає нових значень для збереження.");
      ctx.session = {};
      return;
    }

    await ctx.answerCallbackQuery("Зберігаємо...");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;
    const telegramId = String(ctx.from?.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("telegram_id", telegramId)
      .single();

    if (!profile) return;

    const metrics = ctx.session.metrics ?? [];

    const upserts = Object.entries(values).map(([metricId, value]) => ({
      profile_id: profile.id,
      metric_definition_id: metricId,
      week_start: weekStart,
      value,
      submitted_via: "telegram" as const,
    }));

    const { error } = await supabase
      .from("metric_submissions")
      .upsert(upserts, {
        onConflict: "profile_id,metric_definition_id,week_start",
      });

    if (error) {
      await ctx.editMessageText(`❌ Помилка збереження: ${error.message}`);
      return;
    }

    // Check for criticals and notify admin/viewer
    const criticals = metrics.filter((m) => {
      const v = values[m.id];
      return v !== undefined && calcStatus(m, v) === "critical";
    });

    const summary = metrics
      .filter((m) => values[m.id] !== undefined)
      .map((m) => `• ${m.name}: ${values[m.id]} ${m.unit}`)
      .join("\n");

    await ctx.editMessageText(
      `✅ *Збережено за ${getWeekLabel(weekStart)}!*\n\n${summary}`,
      { parse_mode: "Markdown" }
    );

    if (criticals.length > 0) {
      const { data: adminsRaw } = await supabase
        .from("profiles")
        .select("telegram_id")
        .in("role", ["admin", "viewer"])
        .not("telegram_id", "is", null);

      const admins = adminsRaw as Array<{ telegram_id: string }> | null;

      if (admins?.length) {
        const critText = criticals
          .map((m) => `• ${m.name}: ${values[m.id]} ${m.unit}`)
          .join("\n");

        for (const admin of admins) {
          if (admin.telegram_id && admin.telegram_id !== telegramId) {
            await ctx.api.sendMessage(
              admin.telegram_id,
              `⚠️ *Критичні метрики*\n${critText}`,
              { parse_mode: "Markdown" }
            );
          }
        }
      }
    }

    ctx.session = {};
  });

  // Cancel callback
  bot.callbackQuery("cancel", async (ctx) => {
    ctx.session = {};
    await ctx.answerCallbackQuery("Скасовано");
    await ctx.editMessageText("❌ Введення скасовано");
  });

  // Text message handler (for numeric input)
  bot.on("message:text", async (ctx) => {
    const metricId = ctx.session.awaitingValue;
    if (!metricId) return;

    const metric = ctx.session.metrics?.find((m) => m.id === metricId);
    if (!metric) {
      ctx.session.awaitingValue = null;
      return;
    }

    const value = parseFloat(ctx.message.text.replace(",", "."));
    if (isNaN(value)) {
      await ctx.reply(
        `Введіть числове значення для "${metric.name}" (${metric.unit}):`
      );
      return;
    }

    ctx.session.values = { ...(ctx.session.values ?? {}), [metricId]: value };
    ctx.session.awaitingValue = null;
    await ctx.reply(`Записано: ${value} ${metric.unit}`);
    await showMetricPicker(ctx, { edit: false });
  });

  return bot;
}

async function showMetricPicker(ctx: MyContext, opts: { edit: boolean }) {
  const metrics = ctx.session.metrics ?? [];
  const weekStart = ctx.session.weekStart ?? formatWeekStart(getCurrentWeekStart());
  const values = ctx.session.values ?? {};
  const existing = ctx.session.existing ?? {};
  const answeredIds = new Set([...Object.keys(values), ...Object.keys(existing)]);

  const text =
    `📅 Тиждень: ${getWeekLabel(weekStart)}\n\n` +
    `Оберіть метрику для введення (${answeredIds.size}/${metrics.length} заповнено):`;

  const kb = metricPickerKeyboard(metrics, answeredIds, weekStart);

  if (opts.edit) {
    await ctx.editMessageText(text, { reply_markup: kb });
  } else {
    await ctx.reply(text, { reply_markup: kb });
  }
}
