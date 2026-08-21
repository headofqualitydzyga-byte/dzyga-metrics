import { calcStatus, formatMetricValue, getTrend } from "@/lib/metrics/status";
import MetricSparkline from "./MetricSparkline";
import type { MetricDefinition, MetricSubmission } from "@/types/database";

export default function OcTopRow({
  metrics,
  current,
  prior,
  chartByMetric,
}: {
  metrics: MetricDefinition[];
  current: Map<string, number>;
  prior: Map<string, number>;
  chartByMetric: Map<string, MetricSubmission[]>;
}) {
  return (
    // Cards size to their content (auto-fill) instead of stretching to an
    // equal share of a fixed column count — a wide viewport with few
    // metrics no longer leaves each card padded with dead space.
    <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      {metrics.map((def) => {
        const currentValue = current.get(def.id) ?? null;
        const priorValue = prior.get(def.id) ?? null;
        const trend = getTrend(def, currentValue, priorValue);
        const status = calcStatus(def, currentValue);

        return (
          <div
            key={def.id}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <p className="truncate text-xs text-muted">{def.name}</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-2xl font-bold text-ink">
                  {formatMetricValue(def, currentValue)}
                </p>
                {trend && (
                  <p className={`text-xs ${trend.colorClass}`}>
                    {trend.arrow} {trend.label}
                  </p>
                )}
              </div>
              <div className="h-10 w-16 shrink-0">
                <MetricSparkline submissions={chartByMetric.get(def.id) ?? []} status={status} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
