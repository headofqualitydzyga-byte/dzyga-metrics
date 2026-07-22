import { InlineKeyboard } from "grammy";
import { getWeekLabel, getCurrentWeekStart, formatWeekStart } from "@/lib/metrics/status";

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

export function updateKeyboard(metricId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("Так, оновити", `update:${metricId}:yes`)
    .text("Пропустити", `update:${metricId}:no`);
}
