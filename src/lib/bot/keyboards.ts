import { InlineKeyboard } from "grammy";
import {
  getWeekLabel,
  getMonthLabel,
  getCurrentWeekStart,
  getCurrentMonthStart,
  formatWeekStart,
} from "@/lib/metrics/status";
import type { MetricDefinition } from "@/types/database";

export function weekPickerKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  const current = getCurrentWeekStart();
  const currentStr = formatWeekStart(current);

  kb.text(`📅 Поточний (${getWeekLabel(currentStr)})`, `week:${currentStr}`).row();

  for (let i = 1; i <= 4; i++) {
    const d = new Date(current);
    d.setDate(d.getDate() - i * 7);
    const str = formatWeekStart(d);
    kb.text(getWeekLabel(str), `week:${str}`).row();
  }

  return kb;
}

export function monthPickerKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  const current = getCurrentMonthStart();
  const currentStr = formatWeekStart(current);

  kb.text(`🗓️ Поточний (${getMonthLabel(currentStr)})`, `month:${currentStr}`).row();

  for (let i = 1; i <= 4; i++) {
    const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
    const str = formatWeekStart(d);
    kb.text(getMonthLabel(str), `month:${str}`).row();
  }

  return kb;
}

export function frequencyPickerKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📆 Тижневі метрики", "freq:weekly")
    .row()
    .text("🗓️ Місячні метрики", "freq:monthly");
}

export function businessLinePickerKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🍽️ Кейтеринг", "line:catering")
    .row()
    .text("📦 Бокси", "line:boxes");
}

export function confirmKeyboard(weekStart: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Підтвердити і зберегти", `confirm:${weekStart}`)
    .row()
    .text("❌ Скасувати", "cancel");
}

export function booleanKeyboard(metricId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Так", `bool:${metricId}:100`)
    .text("❌ Ні", `bool:${metricId}:0`);
}

export function metricPickerKeyboard(
  metrics: MetricDefinition[],
  answeredIds: Set<string>,
  weekStart: string
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const m of metrics) {
    const icon = answeredIds.has(m.id) ? "✅" : "⬜";
    kb.text(`${icon} ${m.name}`, `pick:${m.id}`).row();
  }
  if (answeredIds.size > 0) {
    kb.text("💾 Зберегти", `confirm:${weekStart}`).row();
  }
  kb.text("❌ Скасувати", "cancel");
  return kb;
}
