"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MetricDefinition, MetricSubmission } from "@/types/database";

const PALETTE = ["#3b82f6", "#dc2626", "#16a34a", "#d97706", "#8b5cf6", "#0891b2", "#db2777"];

function ukMonth(dateStr: string): string {
  const months = [
    "Січ", "Лют", "Бер", "Кві", "Тра", "Чер",
    "Лип", "Сер", "Вер", "Жов", "Лис", "Гру",
  ];
  const d = new Date(dateStr);
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`;
}

// Overlays multiple metrics' actual values on one chart for comparison.
// Unlike MetricChart, this drops the План/Мін/Макс reference lines — each
// selected metric can have a different plan/unit, so a shared reference
// line wouldn't mean anything across all of them.
export default function MetricComparisonChart({
  metrics,
  submissions,
  period,
}: {
  metrics: MetricDefinition[];
  submissions: MetricSubmission[];
  period: "week" | "month" | "quarter";
}) {
  const weeksBack = period === "week" ? 8 : period === "month" ? 16 : 24;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeksBack * 7);

  const metricIds = new Set(metrics.map((m) => m.id));
  const dates = Array.from(
    new Set(
      submissions
        .filter((s) => metricIds.has(s.metric_definition_id) && new Date(s.week_start) >= cutoff)
        .map((s) => s.week_start)
    )
  ).sort();

  const data = dates.map((date) => {
    const row: Record<string, string | number | null> = { date: ukMonth(date) };
    for (const m of metrics) {
      const sub = submissions.find(
        (s) => s.metric_definition_id === m.id && s.week_start === date
      );
      row[m.name] = sub ? sub.value : null;
    }
    return row;
  });

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-border bg-page">
        <p className="text-sm text-muted">Немає даних за обраний період</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e6e8ec" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#8993a4" }}
          tickLine={false}
          axisLine={{ stroke: "#e6e8ec" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#8993a4" }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            border: "1px solid #e6e8ec",
            borderRadius: 8,
            fontSize: 12,
            color: "#1f2733",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#8993a4", paddingTop: 8 }}
        />

        {metrics.map((m, i) => (
          <Line
            key={m.id}
            type="monotone"
            dataKey={m.name}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
