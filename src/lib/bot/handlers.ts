import { Bot, Context, session, SessionFlavor } from "grammy";
import { createAdminClient } from "@/lib/supabase/server";
import { calcStatus, getCurrentWeekStart, formatWeekStart, getWeekLabel } from "@/lib/metrics/status";
import {
  weekPickerKeyboard,
  confirmKeyboard,
  booleanKeyboard,
  updateKeyboard,
} from "./keyboards";
import type { MetricDefinition } from "@/types/database";

interface SubmitSession {
  weekStart?: string;
  metrics?: MetricDefinition[];
  currentIndex?: number;
  values?: Record<string, number>;
  awaitingUpdate?: string | null;
}

type MyContext = Context & SessionFlavor<SubmitSession>;

export function createBot(token: string) {
  const bot = new Bot<MyContext>(token);

  bot.use(
    session({
      initial: (): SubmitSession => ({}),
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
    ctx.session.currentIndex = undefined;

    await ctx.reply(
      "📅 За який тиждень вводимо метрики?",
      { reply_markup: weekPickerKeyboard() }
    );
  });

  // Week picker callback
  bot.callbackQuery(/^week:(.+)$/, async (ctx) => {
    const weekStart = ctx.match[1];
    ctx.session.weekStart = weekStart;
    ctx.session.currentIndex = 0;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `📅 Тиждень: ${getWeekLabel(weekStart)}\n\nПочинаємо введення метрик...`
    );
    await askNextMetric(ctx);
  });

  // Boolean answer callback
  bot.callbackQuery(/^bool:([^:]+):(\d+)$/, async (ctx) => {
    const [, metricId, valueStr] = ctx.match;
    const value = parseInt(valueStr);
    ctx.session.values = { ...(ctx.session.values ?? {}), [metricId]: value };
    ctx.session.currentIndex = (ctx.session.currentIndex ?? 0) + 1;
    await ctx.answerCallbackQuery(value === 100 ? "✅ Записано: Так" : "❌ Записано: Ні");
    await ctx.editMessageText(value === 100 ? "✅ Так" : "❌ Ні");
    await askNextMetric(ctx);
  });

  // Update existing answer callback
  bot.callbackQuery(/^update:([^:]+):(yes|no)$/, async (ctx) => {
    const [, metricId, decision] = ctx.match;
    await ctx.answerCallbackQuery();
    if (decision === "no") {
      ctx.session.currentIndex = (ctx.session.currentIndex ?? 0) + 1;
      await ctx.editMessageText("Пропущено");
      await askNextMetric(ctx);
    } else {
      ctx.session.awaitingUpdate = metricId;
      const metric = ctx.session.metrics?.find((m) => m.id === metricId);
      if (metric?.value_type === "boolean") {
        await ctx.editMessageText(
          `Оновити: ${metric.name}`,
          { reply_markup: booleanKeyboard(metricId) }
        );
      } else {
        await ctx.editMessageText(
          `Введіть нове значення для "${metric?.name}" (${metric?.unit}):`
        );
      }
    }
  });

  // Confirm callback
  bot.callbackQuery(/^confirm:(.+)$/, async (ctx) => {
    const weekStart = ctx.match[1];
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

    const values = ctx.session.values ?? {};
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
    // Awaiting update for existing metric
    if (ctx.session.awaitingUpdate) {
      const metricId = ctx.session.awaitingUpdate;
      const value = parseFloat(ctx.message.text.replace(",", "."));
      if (isNaN(value)) {
        await ctx.reply("Введіть числове значення:");
        return;
      }
      ctx.session.values = { ...(ctx.session.values ?? {}), [metricId]: value };
      ctx.session.awaitingUpdate = null;
      const metric = ctx.session.metrics?.find((m) => m.id === metricId);
      await ctx.reply(`Записано: ${value} ${metric?.unit}`);
      ctx.session.currentIndex = (ctx.session.currentIndex ?? 0) + 1;
      await askNextMetric(ctx);
      return;
    }

    const metrics = ctx.session.metrics ?? [];
    const idx = ctx.session.currentIndex;
    if (idx === undefined || !metrics[idx]) return;

    const metric = metrics[idx];
    const value = parseFloat(ctx.message.text.replace(",", "."));

    if (isNaN(value)) {
      await ctx.reply(
        `Введіть числове значення для "${metric.name}" (${metric.unit}):`
      );
      return;
    }

    ctx.session.values = { ...(ctx.session.values ?? {}), [metric.id]: value };
    await ctx.reply(`Записано: ${value} ${metric.unit}`);
    ctx.session.currentIndex = idx + 1;
    await askNextMetric(ctx);
  });

  return bot;
}

async function askNextMetric(ctx: MyContext) {
  const metrics = ctx.session.metrics ?? [];
  const idx = ctx.session.currentIndex ?? 0;

  if (idx >= metrics.length) {
    // All done — show summary
    const values = ctx.session.values ?? {};
    const weekStart = ctx.session.weekStart ?? formatWeekStart(getCurrentWeekStart());

    if (Object.keys(values).length === 0) {
      await ctx.reply("Жодного значення не введено. Спробуйте /submit ще раз.");
      ctx.session = {};
      return;
    }

    const summary = metrics
      .filter((m) => values[m.id] !== undefined)
      .map((m) => `• ${m.name}: ${values[m.id]} ${m.unit}`)
      .join("\n");

    await ctx.reply(
      `📋 *Підсумок за ${getWeekLabel(weekStart)}:*\n\n${summary}\n\nПідтверджуємо?`,
      {
        parse_mode: "Markdown",
        reply_markup: confirmKeyboard(weekStart),
      }
    );
    return;
  }

  const metric = metrics[idx];
  const weekStart = ctx.session.weekStart ?? formatWeekStart(getCurrentWeekStart());

  // Check if already submitted
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const telegramId = String(ctx.from?.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("telegram_id", telegramId)
    .single();

  if (profile) {
    const { data: existing } = await supabase
      .from("metric_submissions")
      .select("value")
      .eq("profile_id", profile.id)
      .eq("metric_definition_id", metric.id)
      .eq("week_start", weekStart)
      .single();

    if (existing && !(metric.id in (ctx.session.values ?? {}))) {
      await ctx.reply(
        `Метрика "${metric.name}" вже здана: *${existing.value} ${metric.unit}*\nОновити?`,
        {
          parse_mode: "Markdown",
          reply_markup: updateKeyboard(metric.id),
        }
      );
      return;
    }
  }

  if (metric.value_type === "boolean") {
    await ctx.reply(
      `(${idx + 1}/${metrics.length}) *${metric.name}*\n\nВиконано?`,
      {
        parse_mode: "Markdown",
        reply_markup: booleanKeyboard(metric.id),
      }
    );
  } else {
    await ctx.reply(
      `(${idx + 1}/${metrics.length}) *${metric.name}*\n\nВведіть значення (${metric.unit}):`,
      { parse_mode: "Markdown" }
    );
  }
}
