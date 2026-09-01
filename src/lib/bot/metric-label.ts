import type { MetricDefinition } from "@/types/database";

export type MetricWithDept = MetricDefinition & {
  departments?: { name: string } | null;
};

// Different departments can have identically-named metrics (e.g. every
// department tracking "% витрачених коштів"), which only actually collide
// in /planvalues since it lists metrics across the whole company rather
// than one department at a time. Appends the department name only when
// the metric's name collides with another one in the same list, so the
// common case stays uncluttered.
export function disambiguatedMetricLabel(
  metric: MetricWithDept,
  allMetrics: MetricWithDept[]
): string {
  const collides = allMetrics.some((m) => m.id !== metric.id && m.name === metric.name);
  return collides && metric.departments?.name
    ? `${metric.name} (${metric.departments.name})`
    : metric.name;
}
