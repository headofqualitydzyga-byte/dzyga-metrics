import { formatMetricValue, getTrend } from "@/lib/metrics/status";
import type { MetricDefinition } from "@/types/database";

export default function OcTopRow({
  metrics,
  current,
  prior,
}: {
  metrics: MetricDefinition[];
  current: Map<string, number>;
  prior: Map<string, number>;
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {metrics.map((def) => {
        const currentValue = current.get(def.id) ?? null;
        const priorValue = prior.get(def.id) ?? null;
        const trend = getTrend(def, currentValue, priorValue);

        return (
          <div
            key={def.id}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <p className="truncate text-xs text-muted">{def.name}</p>
            <p className="mt-1 text-2xl font-bold text-ink">
              {formatMetricValue(def, currentValue)}
            </p>
            {trend && (
              <p className={`mt-1 text-xs ${trend.colorClass}`}>
                {trend.arrow} {trend.label}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
