import Link from "next/link";
import {
  calcStatus,
  getChartIcon,
  formatDeviation,
} from "@/lib/metrics/status";
import DeptIcon from "@/components/DeptIcon";
import type { Department, MetricDefinition, MetricSubmission } from "@/types/database";

const STATUS_DOT: Record<string, string> = {
  normal: "bg-status-normal",
  warning: "bg-status-warning",
  critical: "bg-status-critical",
  not_submitted: "bg-border",
};

const STATUS_LABEL: Record<string, string> = {
  normal: "Норма",
  warning: "Увага",
  critical: "Критично",
  not_submitted: "Не здано",
};

export default function DepartmentCard({
  department,
  metrics,
  submissions,
  weekStart,
  monthStart,
  view,
  line,
}: {
  department: Department;
  metrics: MetricDefinition[];
  submissions: MetricSubmission[];
  weekStart: string;
  monthStart: string;
  view: "weekly" | "monthly";
  line: "catering" | "boxes" | "all";
}) {
  const top = metrics.slice(0, 4);

  const statuses = metrics.map((def) => {
    const sub = submissions.find((s) => s.metric_definition_id === def.id);
    return calcStatus(def, sub?.value ?? null);
  });

  const overallStatus =
    statuses.includes("critical")
      ? "critical"
      : statuses.includes("warning")
      ? "warning"
      : statuses.every((s) => s === "not_submitted")
      ? "not_submitted"
      : "normal";

  return (
    <Link
      href={`/dashboard/${department.id}?week=${weekStart}&month=${monthStart}&view=${view}&line=${line}`}
      className="group block rounded-xl border border-border bg-surface p-5 hover:border-accent transition-colors"
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: department.color + "20" }}
          >
            <DeptIcon
              icon={department.icon}
              className="h-5 w-5"
              style={{ color: department.color }}
            />
          </div>
          <div>
            <h2 className="font-semibold text-ink group-hover:text-accent transition-colors">
              {department.name}
            </h2>
            <p className="text-xs text-muted">
              {metrics.length} {metrics.length === 1 ? "метрика" : "метрик"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[overallStatus]}`}
          />
          <span className="text-xs text-muted">{STATUS_LABEL[overallStatus]}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {top.map((def) => {
          const sub = submissions.find((s) => s.metric_definition_id === def.id);
          const status = calcStatus(def, sub?.value ?? null);
          const dotColor = STATUS_DOT[status];

          return (
            <div
              key={def.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate text-muted">{def.name}</span>
              <div className="flex shrink-0 items-center gap-2">
                {sub != null ? (
                  <span className="font-medium text-ink">
                    {sub.value} {def.unit}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
                <span className={`text-xs text-muted`}>
                  {getChartIcon(def.type)}
                </span>
                <span className={`h-2 w-2 rounded-full ${dotColor}`} />
              </div>
            </div>
          );
        })}
        {metrics.length > 4 && (
          <p className="text-xs text-muted">
            +{metrics.length - 4} ще…
          </p>
        )}
      </div>
    </Link>
  );
}
