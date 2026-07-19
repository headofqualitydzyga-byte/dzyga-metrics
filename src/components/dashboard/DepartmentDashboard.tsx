"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  calcStatus,
  formatDeviation,
  getChartIcon,
  getStatusBg,
  getWeekLabel,
  getCurrentWeekStart,
  formatWeekStart,
} from "@/lib/metrics/status";
import MetricChart from "./MetricChart";
import WeekSelector from "./WeekSelector";
import type {
  Department,
  MetricDefinition,
  MetricSubmission,
} from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  normal: "Норма",
  warning: "Увага",
  critical: "Критично",
  not_submitted: "Не здано",
};

const STATUS_BADGE: Record<string, string> = {
  normal: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-600",
  not_submitted: "bg-page text-muted",
};

export default function DepartmentDashboard({
  department,
  metrics,
  weekSubmissions,
  chartSubmissions,
  weekStart,
  period,
  managerName,
  canSubmitWeb,
}: {
  department: Department;
  metrics: MetricDefinition[];
  weekSubmissions: MetricSubmission[];
  chartSubmissions: MetricSubmission[];
  weekStart: string;
  period: "week" | "month" | "quarter";
  managerName: string | null;
  canSubmitWeb: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(
    metrics[0]?.id ?? null
  );
  const [submitValues, setSubmitValues] = useState<Record<string, string>>({});
  const [submitComments, setSubmitComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function handlePeriodChange(p: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    router.push(`?${params.toString()}`);
  }

  const selectedMetric = metrics.find((m) => m.id === selectedMetricId);
  const selectedSubs = chartSubmissions.filter(
    (s) => s.metric_definition_id === selectedMetricId
  );

  async function handleWebSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const entries = Object.entries(submitValues)
      .filter(([, v]) => v !== "")
      .map(([metricId, value]) => ({
        metric_definition_id: metricId,
        value: parseFloat(value),
        comment: submitComments[metricId] || null,
        week_start: weekStart,
      }));

    await fetch("/api/metrics/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });

    setSubmitting(false);
    router.refresh();
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: department.color + "20" }}
          >
            <span
              className="text-base font-bold"
              style={{ color: department.color }}
            >
              {department.name[0]}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink">
              {department.name}
            </h1>
            {managerName && (
              <p className="text-sm text-muted">{managerName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <WeekSelector currentWeek={weekStart} />
          <a
            href={`/api/metrics/export?department=${department.id}&week=${weekStart}`}
            download
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-ink transition-colors"
          >
            Експорт Excel
          </a>
        </div>
      </div>

      {/* Period toggle */}
      <div className="mb-4 flex gap-1">
        {(["week", "month", "quarter"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handlePeriodChange(p)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              period === p
                ? "bg-accent text-white"
                : "text-muted hover:text-ink"
            }`}
          >
            {p === "week" ? "Тиждень" : p === "month" ? "Місяць" : "Квартал"}
          </button>
        ))}
      </div>

      {/* Metrics table */}
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-page">
              <th className="px-4 py-3 text-left font-medium text-muted">Метрика</th>
              <th className="px-4 py-3 text-right font-medium text-muted">План</th>
              <th className="px-4 py-3 text-right font-medium text-muted">Факт</th>
              <th className="px-4 py-3 text-right font-medium text-muted">Відхилення</th>
              <th className="px-4 py-3 text-center font-medium text-muted">Тип</th>
              <th className="px-4 py-3 text-center font-medium text-muted">Статус</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((def) => {
              const sub = weekSubmissions.find(
                (s) => s.metric_definition_id === def.id
              );
              const status = calcStatus(def, sub?.value ?? null);
              const rowBg = getStatusBg(status);
              const isSelected = selectedMetricId === def.id;

              return (
                <tr
                  key={def.id}
                  onClick={() => setSelectedMetricId(def.id)}
                  className={`border-b border-border last:border-0 cursor-pointer transition-colors ${rowBg} ${
                    isSelected
                      ? "ring-1 ring-inset ring-accent"
                      : "hover:bg-page"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    {def.name}
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    {def.type === "range"
                      ? `${def.range_min ?? "?"}–${def.range_max ?? "?"}`
                      : (def.plan_value ?? "—")}{" "}
                    {def.unit}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      status === "critical"
                        ? "text-status-critical"
                        : status === "warning"
                        ? "text-status-warning"
                        : status === "normal"
                        ? "text-blue-600"
                        : "text-muted"
                    }`}
                  >
                    {sub != null ? `${sub.value} ${def.unit}` : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right text-xs ${
                      status === "normal"
                        ? "text-status-normal"
                        : status === "not_submitted"
                        ? "text-muted"
                        : "text-status-critical"
                    }`}
                  >
                    {sub != null ? formatDeviation(def, sub.value) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-muted">
                    {getChartIcon(def.type)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {metrics.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">
            Немає активних метрик для цього відділу
          </p>
        )}
      </div>

      {/* Chart */}
      {selectedMetric && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-1 text-sm font-semibold text-ink">
            Динаміка: {selectedMetric.name}
          </h2>
          <p className="mb-4 text-xs text-muted">
            {getWeekLabel(weekStart)} · {selectedMetric.unit}
          </p>
          <MetricChart
            metric={selectedMetric}
            submissions={selectedSubs}
            period={period}
          />
        </div>
      )}

      {/* Web submission form (for managers only) */}
      {canSubmitWeb && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink">
            Внести показники за {getWeekLabel(weekStart)}
          </h2>
          <form onSubmit={handleWebSubmit} className="flex flex-col gap-4">
            {metrics.map((def) => {
              const existing = weekSubmissions.find(
                (s) => s.metric_definition_id === def.id
              );
              return (
                <div key={def.id} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="flex items-center text-sm font-medium text-ink">
                    {def.name}
                    <span className="ml-1 text-xs text-muted">({def.unit})</span>
                  </label>
                  {def.value_type === "boolean" ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSubmitValues((v) => ({ ...v, [def.id]: "100" }))
                        }
                        className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                          submitValues[def.id] === "100"
                            ? "border-green-500 bg-green-50 text-green-700"
                            : "border-border text-muted hover:border-accent"
                        }`}
                      >
                        ✅ Так
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSubmitValues((v) => ({ ...v, [def.id]: "0" }))
                        }
                        className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                          submitValues[def.id] === "0"
                            ? "border-red-400 bg-red-50 text-red-600"
                            : "border-border text-muted hover:border-accent"
                        }`}
                      >
                        ❌ Ні
                      </button>
                      {existing && (
                        <span className="self-center text-xs text-muted">
                          (поточне: {existing.value === 100 ? "Так" : "Ні"})
                        </span>
                      )}
                    </div>
                  ) : (
                    <input
                      type="number"
                      step="any"
                      placeholder={
                        existing
                          ? `Поточне: ${existing.value}`
                          : `Введіть ${def.unit}`
                      }
                      value={submitValues[def.id] ?? ""}
                      onChange={(e) =>
                        setSubmitValues((v) => ({
                          ...v,
                          [def.id]: e.target.value,
                        }))
                      }
                      className="rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                    />
                  )}
                  <input
                    type="text"
                    placeholder="Коментар (необов'язково)"
                    value={submitComments[def.id] ?? ""}
                    onChange={(e) =>
                      setSubmitComments((v) => ({
                        ...v,
                        [def.id]: e.target.value,
                      }))
                    }
                    className="rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              );
            })}
            <button
              type="submit"
              disabled={submitting || Object.keys(submitValues).length === 0}
              className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {submitting ? "Збереження..." : "Зберегти показники"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
