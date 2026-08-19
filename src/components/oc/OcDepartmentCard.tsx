import Link from "next/link";
import {
  calcStatus,
  formatMetricValue,
  getTrend,
  STATUS_DOT,
} from "@/lib/metrics/status";
import DeptIcon from "@/components/DeptIcon";
import MetricSparkline from "./MetricSparkline";
import type { Department, MetricDefinition, MetricSubmission } from "@/types/database";

export default function OcDepartmentCard({
  department,
  metrics,
  current,
  prior,
  chartByMetric,
  responsibleName,
}: {
  department: Department;
  metrics: MetricDefinition[];
  current: Map<string, number>;
  prior: Map<string, number>;
  chartByMetric: Map<string, MetricSubmission[]>;
  responsibleName: string | null;
}) {
  return (
    <Link
      href={`/dashboard/${department.id}`}
      className="group block rounded-xl border border-border bg-surface p-5 hover:border-accent transition-colors"
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: department.color + "20" }}
        >
          <DeptIcon icon={department.icon} className="h-5 w-5" style={{ color: department.color }} />
        </div>
        <div>
          <h2 className="font-semibold text-ink group-hover:text-accent transition-colors">
            {department.name}
          </h2>
          <p className="text-xs text-muted">Відповідальний: {responsibleName ?? "—"}</p>
        </div>
      </div>

      {metrics.length === 0 ? (
        <p className="text-sm text-muted">Немає ключової метрики</p>
      ) : (
        <div className="flex flex-col gap-4">
          {metrics.map((def) => {
            const currentValue = current.get(def.id) ?? null;
            const priorValue = prior.get(def.id) ?? null;
            const status = calcStatus(def, currentValue);
            const trend = getTrend(def, currentValue, priorValue);

            const showBar =
              def.type !== "range" &&
              def.value_type !== "boolean" &&
              def.plan_value != null &&
              currentValue !== null;
            const percent = showBar
              ? Math.round((currentValue as number) / (def.plan_value as number) * 100)
              : null;

            return (
              <div key={def.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-muted">{def.name}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="font-medium text-ink">
                      {formatMetricValue(def, currentValue)}
                    </span>
                    {trend && (
                      <span className={`text-xs ${trend.colorClass}`}>{trend.arrow}</span>
                    )}
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
                  </div>
                </div>
                {showBar && (
                  <>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-page">
                      <div
                        className={`h-full rounded-full ${STATUS_DOT[status]}`}
                        style={{ width: `${Math.min(percent ?? 0, 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted">
                      <span>План: {def.plan_value} {def.unit}</span>
                      <span>{percent}%</span>
                    </div>
                  </>
                )}
                <div className="mt-1 flex justify-end">
                  <MetricSparkline metric={def} submissions={chartByMetric.get(def.id) ?? []} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Link>
  );
}
