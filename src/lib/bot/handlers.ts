import { Bot, Context, session, SessionFlavor, StorageAdapter } from "grammy";
import { createAdminClient } from "@/lib/supabase/server";
import {
  calcStatus,
  getCurrentWeekStart,
  getPreviousWeekStart,
  getCurrentMonthStart,
  formatWeekStart,
  getWeekLabel,
  getMonthLabel,
  getPeriodLabel,
} from "@/lib/metrics/status";
import { getAccessibleMetricIds, filterByAccess } from "@/lib/metrics/access";
import {
  weekPickerKeyboard,
  monthPickerKeyboard,
  frequencyPickerKeyboard,
  businessLinePickerKeyboard,
  booleanKeyboard,
  metricPickerKeyboard,
  planFrequencyPickerKeyboard,
  planBooleanKeyboard,
  planMetricPickerKeyboard,
  planWeekPickerKeyboard,
  planMonthPickerKeyboard,
} from "./keyboards";
import type { BusinessLine, MetricDefinition } from "@/types/database";

const LINE_LABELS: Record<BusinessLine, string> = {
  catering: "🍽️ Кейтеринг",
  boxes: "📦 Бокси",
};

// PLAN_SETTER_TELEGRAM_ID may hold multiple comma-separated IDs (e.g. the
// COO plus an admin testing the flow).
export function getPlanSetterIds(): string[] {
  return (process.env.PLAN_SETTER_TELEGRAM_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

interface SubmitSession {
  // Generic active period key: a Monday for a weekly flow, 1st-of-month
  // for a monthly flow — see `frequency` for which one it currently is.
  weekStart?: string;
  frequency?: "weekly" | "monthly";
  businessLine?: BusinessLine;
  allMetrics?: MetricDefinition[];
  metrics?: MetricDefinition[];
  values?: Record<string, number>;
  existing?: Record<string, number>;
  awaitingValue?: string | null;

  // /planvalues flow (recurring plan-value entry, separate from the above
  // actual-value submission flow — driven by a single designated plan-setter).
  planAllMetrics?: MetricDefinition[];
  planFrequency?: "weekly" | "monthly";
  planMetrics?: MetricDefinition[];
  planValues?: Record<string, number>;
  planAwaiting?: string | null;
  // Overrides the default "current period" staleness check in
  // showPlanPicker when the plan-setter explicitly picks a different week/
  // month via the "Обрати інший період" button. Unset = current period.
  planPeriodStart?: string;
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
        `/submit — ввести метрики\n` +
        `/status — перевірити статус\n` +
        `/help — допомога`
    );
  });

  // /help
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "📋 *Команди:*\n\n" +
        "/submit — ввести метрики\n" +
        "/status — перевірити статус\n" +
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
      .select("id, role, department_id")
      .eq("telegram_id", telegramId)
      .single();

    if (!profile) {
      await ctx.reply("Ваш Telegram не прив'язано. Зверніться до адміністратора.");
      return;
    }

    const { data: metricsRaw } = await supabase
      .from("metric_definitions")
      .select("*")
      .eq("department_id", profile.department_id)
      .eq("is_active", true)
      .order("sort_order");

    let metrics = (metricsRaw ?? []) as MetricDefinition[];
    if (profile.role !== "admin") {
      const accessibleIds = await getAccessibleMetricIds(supabase, profile.id);
      metrics = filterByAccess(metrics, profile.role, accessibleIds);
    }

    if (!metrics.length) {
      await ctx.reply("Немає доступних метрик. Зверніться до адміністратора.");
      return;
    }

    const weekStart = formatWeekStart(getPreviousWeekStart());
    const monthStart = formatWeekStart(getCurrentMonthStart());

    const { data: subsRaw } = await supabase
      .from("metric_submissions")
      .select("metric_definition_id, value, week_start")
      .eq("profile_id", profile.id)
      .in("week_start", [weekStart, monthStart]);

    const subs = (subsRaw ?? []) as Array<{
      metric_definition_id: string;
      value: number;
      week_start: string;
    }>;

    const renderGroup = (defs: MetricDefinition[], periodStart: string) =>
      defs
        .map((m) => {
          const sub = subs.find(
            (s) => s.metric_definition_id === m.id && s.week_start === periodStart
          );
          const icon = sub ? "✅" : "⬜";
          return `${icon} ${m.name}${sub ? `: ${sub.value} ${m.unit}` : ""}`;
        })
        .join("\n");

    const renderByLine = (freqMetrics: MetricDefinition[], periodStart: string) => {
      const catering = freqMetrics.filter((m) => m.business_line === "catering");
      const boxes = freqMetrics.filter((m) => m.business_line === "boxes");
      const sections: string[] = [];
      if (catering.length) sections.push(`${LINE_LABELS.catering}:\n${renderGroup(catering, periodStart)}`);
      if (boxes.length) sections.push(`${LINE_LABELS.boxes}:\n${renderGroup(boxes, periodStart)}`);
      return sections.join("\n\n");
    };

    const weekly = metrics.filter((m) => m.frequency === "weekly");
    const monthly = metrics.filter((m) => m.frequency === "monthly");

    const parts: string[] = [];
    if (weekly.length) {
      parts.push(`📆 *Тижневі (${getWeekLabel(weekStart)}):*\n\n${renderByLine(weekly, weekStart)}`);
    }
    if (monthly.length) {
      parts.push(`🗓️ *Місячні (${getMonthLabel(monthStart)}):*\n\n${renderByLine(monthly, monthStart)}`);
    }

    await ctx.reply(`📊 *Статус:*\n\n${parts.join("\n\n")}`, { parse_mode: "Markdown" });
  });

  // /submit
  bot.command("submit", async (ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;
    const telegramId = String(ctx.from?.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, department_id")
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

    let metrics = (metricsData ?? []) as MetricDefinition[];
    if (profile.role !== "admin") {
      const accessibleIds = await getAccessibleMetricIds(supabase, profile.id);
      metrics = filterByAccess(metrics, profile.role, accessibleIds);
    }

    if (!metrics.length) {
      await ctx.reply("Немає доступних метрик. Зверніться до адміністратора.");
      return;
    }

    ctx.session.allMetrics = metrics;
    ctx.session.values = {};
    ctx.session.existing = {};
    ctx.session.awaitingValue = null;

    const weekly = metrics.filter((m) => m.frequency === "weekly");
    const monthly = metrics.filter((m) => m.frequency === "monthly");

    if (weekly.length && monthly.length) {
      await ctx.reply("Тижневі чи місячні метрики вводимо?", {
        reply_markup: frequencyPickerKeyboard(),
      });
      return;
    }

    ctx.session.frequency = weekly.length ? "weekly" : "monthly";
    await promptBusinessLineOrPeriod(ctx, { edit: false });
  });

  // /planvalues — restricted to the designated plan-setter (PLAN_SETTER_TELEGRAM_ID)
  bot.command("planvalues", async (ctx) => {
    const telegramId = String(ctx.from?.id);
    if (!getPlanSetterIds().includes(telegramId)) {
      await ctx.reply("Ця команда недоступна.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;
    const { data: defsRaw } = await supabase
      .from("metric_definitions")
      .select("*")
      .eq("plan_recurring", true)
      .eq("is_active", true)
      .order("sort_order");

    const metrics = (defsRaw ?? []) as MetricDefinition[];
    if (!metrics.length) {
      await ctx.reply("Немає метрик з автооновленням планових значень.");
      return;
    }

    ctx.session.planAllMetrics = metrics;
    ctx.session.planValues = {};
    ctx.session.planAwaiting = null;
    ctx.session.planPeriodStart = undefined;

    const weekly = metrics.filter((m) => m.frequency === "weekly");
    const monthly = metrics.filter((m) => m.frequency === "monthly");

    if (weekly.length && monthly.length) {
      await ctx.reply("Тижневі чи місячні планові значення вводимо?", {
        reply_markup: planFrequencyPickerKeyboard(),
      });
      return;
    }

    ctx.session.planFrequency = weekly.length ? "weekly" : "monthly";
    ctx.session.planMetrics = weekly.length ? weekly : monthly;
    await showPlanPicker(ctx, { edit: false });
  });

  // Plan frequency choice callback (only shown when both kinds are pending)
  bot.callbackQuery(/^planfreq:(weekly|monthly)$/, async (ctx) => {
    const frequency = ctx.match[1] as "weekly" | "monthly";
    ctx.session.planFrequency = frequency;
    ctx.session.planMetrics = (ctx.session.planAllMetrics ?? []).filter(
      (m) => m.frequency === frequency
    );
    await ctx.answerCallbackQuery();
    await showPlanPicker(ctx, { edit: true });
  });

  // Plan-setter wants to set a plan value for a different week/month than
  // the current one (e.g. get ahead and fill in next week's target early).
  bot.callbackQuery("planperiodpicker", async (ctx) => {
    await ctx.answerCallbackQuery();
    const frequency = ctx.session.planFrequency ?? "weekly";
    const text =
      frequency === "monthly"
        ? "🗓️ За який місяць вносимо планові значення?"
        : "📅 За який тиждень вносимо планові значення?";
    const kb = frequency === "monthly" ? planMonthPickerKeyboard() : planWeekPickerKeyboard();
    await ctx.editMessageText(text, { reply_markup: kb });
  });

  bot.callbackQuery(/^planweek:(.+)$/, async (ctx) => {
    ctx.session.planPeriodStart = ctx.match[1];
    await ctx.answerCallbackQuery();
    await showPlanPicker(ctx, { edit: true });
  });

  bot.callbackQuery(/^planmonth:(.+)$/, async (ctx) => {
    ctx.session.planPeriodStart = ctx.match[1];
    await ctx.answerCallbackQuery();
    await showPlanPicker(ctx, { edit: true });
  });

  // Returned from the period picker without changing the period
  bot.callbackQuery("planperiodback", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showPlanPicker(ctx, { edit: true });
  });

  // Plan metric picker: plan-setter chose which metric's plan value to enter
  bot.callbackQuery(/^planpick:(.+)$/, async (ctx) => {
    const metricId = ctx.match[1];
    const metric = ctx.session.planMetrics?.find((m) => m.id === metricId);
    if (!metric) {
      await ctx.answerCallbackQuery("Метрику не знайдено");
      return;
    }
    await ctx.answerCallbackQuery();

    if (metric.value_type === "boolean") {
      await ctx.editMessageText(`*${metric.name}*\n\nПланове значення: Так?`, {
        parse_mode: "Markdown",
        reply_markup: planBooleanKeyboard(metric.id),
      });
    } else {
      ctx.session.planAwaiting = metricId;
      const current = ctx.session.planValues?.[metricId] ?? metric.plan_value ?? undefined;
      await ctx.editMessageText(
        `*${metric.name}*\n\nВведіть нове планове значення (${metric.unit})` +
          (current !== undefined ? `\nПоточне: ${current}` : ""),
        { parse_mode: "Markdown" }
      );
    }
  });

  // Plan boolean answer callback
  bot.callbackQuery(/^planbool:([^:]+):(\d+)$/, async (ctx) => {
    const [, metricId, valueStr] = ctx.match;
    const value = parseInt(valueStr);
    ctx.session.planValues = { ...(ctx.session.planValues ?? {}), [metricId]: value };
    await ctx.answerCallbackQuery(value === 100 ? "✅ Записано: Так" : "❌ Записано: Ні");
    await showPlanPicker(ctx, { edit: true });
  });

  // Plan confirm callback: writes accumulated plan values onto metric_definitions
  bot.callbackQuery("planconfirm", async (ctx) => {
    const values = ctx.session.planValues ?? {};

    if (Object.keys(values).length === 0) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText("Немає нових значень для збереження.");
      ctx.session = {};
      return;
    }

    await ctx.answerCallbackQuery("Зберігаємо...");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;
    const now = new Date().toISOString();

    for (const [metricId, value] of Object.entries(values)) {
      await supabase
        .from("metric_definitions")
        .update({ plan_value: value, plan_value_updated_at: now })
        .eq("id", metricId);
    }

    const metrics = ctx.session.planMetrics ?? [];
    const summary = metrics
      .filter((m) => values[m.id] !== undefined)
      .map((m) => `• ${m.name}: ${values[m.id]} ${m.unit}`)
      .join("\n");

    await ctx.editMessageText(`✅ *Планові значення оновлено!*\n\n${summary}`, {
      parse_mode: "Markdown",
    });

    ctx.session = {};
  });

  // Frequency choice callback (only shown when both kinds are available)
  bot.callbackQuery(/^freq:(weekly|monthly)$/, async (ctx) => {
    const frequency = ctx.match[1] as "weekly" | "monthly";
    ctx.session.frequency = frequency;
    await ctx.answerCallbackQuery();
    await promptBusinessLineOrPeriod(ctx, { edit: true });
  });

  // Business-line choice callback (only shown when both kinds are available)
  bot.callbackQuery(/^line:(catering|boxes)$/, async (ctx) => {
    const businessLine = ctx.match[1] as BusinessLine;
    const frequency = ctx.session.frequency ?? "weekly";
    ctx.session.businessLine = businessLine;
    ctx.session.metrics = (ctx.session.allMetrics ?? []).filter(
      (m) => m.frequency === frequency && m.business_line === businessLine
    );
    await ctx.answerCallbackQuery();
    await promptPeriod(ctx, { edit: true });
  });

  // Period picker callback (week or month) — loads already-saved values,
  // then shows the metric picker.
  async function handlePeriodPicked(ctx: MyContext, periodStart: string) {
    ctx.session.weekStart = periodStart;
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
      const metricIds = (ctx.session.metrics ?? []).map((m) => m.id);
      const { data: subsRaw } = await supabase
        .from("metric_submissions")
        .select("metric_definition_id, value")
        .eq("profile_id", profile.id)
        .eq("week_start", periodStart)
        .in("metric_definition_id", metricIds);
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
  }

  bot.callbackQuery(/^week:(.+)$/, (ctx) => handlePeriodPicked(ctx, ctx.match[1]));
  bot.callbackQuery(/^month:(.+)$/, (ctx) => handlePeriodPicked(ctx, ctx.match[1]));

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
    const frequency = ctx.session.frequency ?? "weekly";
    const businessLine = ctx.session.businessLine;

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

    const lineLabel = businessLine ? ` · ${LINE_LABELS[businessLine]}` : "";
    await ctx.editMessageText(
      `✅ *Збережено за ${getPeriodLabel(frequency, weekStart)}${lineLabel}!*\n\n${summary}`,
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
    const planMetricId = ctx.session.planAwaiting;
    if (planMetricId) {
      const metric = ctx.session.planMetrics?.find((m) => m.id === planMetricId);
      if (!metric) {
        ctx.session.planAwaiting = null;
        return;
      }

      const value = parseFloat(ctx.message.text.replace(",", "."));
      if (isNaN(value)) {
        await ctx.reply(
          `Введіть числове значення для "${metric.name}" (${metric.unit}):`
        );
        return;
      }

      ctx.session.planValues = { ...(ctx.session.planValues ?? {}), [planMetricId]: value };
      ctx.session.planAwaiting = null;
      await ctx.reply(`Записано: ${value} ${metric.unit}`);
      await showPlanPicker(ctx, { edit: false });
      return;
    }

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

// After frequency is resolved: narrow to that frequency's metrics, and if
// they span both business lines, ask which one; otherwise skip straight to
// the period picker.
async function promptBusinessLineOrPeriod(ctx: MyContext, opts: { edit: boolean }) {
  const frequency = ctx.session.frequency ?? "weekly";
  const freqMetrics = (ctx.session.allMetrics ?? []).filter((m) => m.frequency === frequency);
  const catering = freqMetrics.filter((m) => m.business_line === "catering");
  const boxes = freqMetrics.filter((m) => m.business_line === "boxes");

  if (catering.length && boxes.length) {
    const text = "Кейтеринг чи Бокси?";
    const kb = businessLinePickerKeyboard();
    if (opts.edit) await ctx.editMessageText(text, { reply_markup: kb });
    else await ctx.reply(text, { reply_markup: kb });
    return;
  }

  ctx.session.businessLine = catering.length ? "catering" : "boxes";
  ctx.session.metrics = freqMetrics;
  await promptPeriod(ctx, opts);
}

async function promptPeriod(ctx: MyContext, opts: { edit: boolean }) {
  const frequency = ctx.session.frequency ?? "weekly";
  const text =
    frequency === "monthly"
      ? "🗓️ За який місяць вводимо метрики?"
      : "📅 За який тиждень вводимо метрики?";
  const kb = frequency === "monthly" ? monthPickerKeyboard() : weekPickerKeyboard();

  if (opts.edit) await ctx.editMessageText(text, { reply_markup: kb });
  else await ctx.reply(text, { reply_markup: kb });
}

async function showMetricPicker(ctx: MyContext, opts: { edit: boolean }) {
  const metrics = ctx.session.metrics ?? [];
  const frequency = ctx.session.frequency ?? "weekly";
  const weekStart = ctx.session.weekStart ?? formatWeekStart(getPreviousWeekStart());
  const values = ctx.session.values ?? {};
  const existing = ctx.session.existing ?? {};
  const answeredIds = new Set([...Object.keys(values), ...Object.keys(existing)]);

  const periodIcon = frequency === "monthly" ? "🗓️ Місяць" : "📅 Тиждень";
  const lineLabel = ctx.session.businessLine ? ` · ${LINE_LABELS[ctx.session.businessLine]}` : "";
  const text =
    `${periodIcon}: ${getPeriodLabel(frequency, weekStart)}${lineLabel}\n\n` +
    `Оберіть метрику для введення (${answeredIds.size}/${metrics.length} заповнено):`;

  const kb = metricPickerKeyboard(metrics, answeredIds, weekStart);

  if (opts.edit) {
    await ctx.editMessageText(text, { reply_markup: kb });
  } else {
    await ctx.reply(text, { reply_markup: kb });
  }
}

// Marks a plan_recurring metric as already handled for the current period
// if it was either updated in this chat session or has a fresh-enough
// plan_value_updated_at from an earlier /planvalues run this period.
async function showPlanPicker(ctx: MyContext, opts: { edit: boolean }) {
  const metrics = ctx.session.planMetrics ?? [];
  const frequency = ctx.session.planFrequency ?? "weekly";
  const values = ctx.session.planValues ?? {};
  const periodStart = ctx.session.planPeriodStart
    ? new Date(ctx.session.planPeriodStart)
    : frequency === "monthly"
      ? getCurrentMonthStart()
      : getCurrentWeekStart();

  const answeredIds = new Set(
    metrics
      .filter(
        (m) =>
          values[m.id] !== undefined ||
          (m.plan_value_updated_at && new Date(m.plan_value_updated_at) >= periodStart)
      )
      .map((m) => m.id)
  );

  const periodIcon = frequency === "monthly" ? "🗓️ Місячні" : "📅 Тижневі";
  const text =
    `${periodIcon} планові значення\n\n` +
    `Оберіть метрику, щоб внести планове значення (${answeredIds.size}/${metrics.length} оновлено):`;

  const kb = planMetricPickerKeyboard(metrics, answeredIds).row().text(
    "📆 Обрати інший період",
    "planperiodpicker"
  );

  if (opts.edit) {
    await ctx.editMessageText(text, { reply_markup: kb });
  } else {
    await ctx.reply(text, { reply_markup: kb });
  }
}
