import type { MetricDefinition, MetricStatus } from "@/types/database";

export function calcStatus(
  def: MetricDefinition,
  value: number | null
): MetricStatus {
  if (value === null) return "not_submitted";

  if (def.type === "growing") {
    if (def.plan_value === null) return "normal";
    const deviation = ((value - def.plan_value) / def.plan_value) * 100;
    if (deviation >= -def.warning_threshold) return "normal";
    if (deviation >= -def.critical_threshold) return "warning";
    return "critical";
  }

  if (def.type === "declining") {
    if (def.plan_value === null) return "normal";
    const deviation = ((value - def.plan_value) / def.plan_value) * 100;
    if (deviation <= def.warning_threshold) return "normal";
    if (deviation <= def.critical_threshold) return "warning";
    return "critical";
  }

  if (def.type === "range") {
    const min = def.range_min ?? -Infinity;
    const max = def.range_max ?? Infinity;
    if (value >= min && value <= max) return "normal";
    // Distance outside the corridor as % of corridor width
    const width = (def.range_max ?? 0) - (def.range_min ?? 0);
    if (width <= 0) return "critical";
    const excess =
      value < min
        ? ((min - value) / width) * 100
        : ((value - max) / width) * 100;
    if (excess <= def.warning_threshold) return "warning";
    return "critical";
  }

  return "normal";
}

export function calcDeviation(
  def: MetricDefinition,
  value: number | null
): { absolute: number | null; percent: number | null } {
  if (value === null || def.plan_value === null) {
    return { absolute: null, percent: null };
  }
  const absolute = value - def.plan_value;
  const percent = (absolute / def.plan_value) * 100;
  return { absolute, percent };
}

export function formatDeviation(
  def: MetricDefinition,
  value: number | null
): string {
  if (value === null) return "—";

  if (def.type === "range") {
    const min = def.range_min ?? 0;
    const max = def.range_max ?? 0;
    if (value >= min && value <= max) return "В нормі";
    if (value < min) return `−${(min - value).toFixed(1)} від мін`;
    return `+${(value - max).toFixed(1)} від макс`;
  }

  const { absolute, percent } = calcDeviation(def, value);
  if (absolute === null || percent === null) return "—";

  const sign = absolute >= 0 ? "+" : "";
  const absStr = `${sign}${absolute.toFixed(1)} ${def.unit}`;
  const pctStr = `${sign}${percent.toFixed(1)}%`;

  return def.value_type === "percent" ? pctStr : `${absStr} (${pctStr})`;
}

export function getStatusColor(status: MetricStatus): string {
  switch (status) {
    case "normal":
      return "text-status-normal";
    case "warning":
      return "text-status-warning";
    case "critical":
      return "text-status-critical";
    default:
      return "text-muted";
  }
}

export function getStatusBg(status: MetricStatus): string {
  switch (status) {
    case "warning":
      return "bg-amber-50";
    case "critical":
      return "bg-red-50";
    default:
      return "";
  }
}

export function getChartIcon(type: MetricDefinition["type"]): string {
  switch (type) {
    case "growing":
      return "↗";
    case "declining":
      return "↘";
    case "range":
      return "↔";
  }
}

export function getCurrentWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function formatWeekStart(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function getWeekLabel(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}
