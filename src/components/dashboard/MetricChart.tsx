"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { MetricDefinition, MetricSubmission } from "@/types/database";

function ukMonth(dateStr: string): string {
  const months = [
    "Січ", "Лют", "Бер", "Кві", "Тра", "Чер",
    "Лип", "Сер", "Вер", "Жов", "Лис", "Гру",
  ];
  const d = new Date(dateStr);
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`;
}

export default function MetricChart({
  metric,
  submissions,
  period,
}: {
  metric: MetricDefinition;
  submissions: MetricSubmission[];
  period: "week" | "month" | "quarter";
}) {
  const weeksBack = period === "week" ? 8 : period === "month" ? 16 : 24;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeksBack * 7);

  const filtered = submissions
    .filter((s) => new Date(s.week_start) >= cutoff)
    .sort((a, b) => a.week_start.localeCompare(b.week_start));

  const data = filtered.map((s) => ({
    date: ukMonth(s.week_start),
    Факт: s.value,
    План: metric.plan_value,
    Мін: metric.range_min,
    Макс: metric.range_max,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-border bg-page">
        <p className="text-sm text-muted">Немає даних за обраний період</p>
      </div>
    );
  }

  const factColor =
    metric.type === "declining"
      ? "#e5672a"
      : metric.type === "range"
      ? "#3b82f6"
      : "#3b82f6";

  return (
    <ResponsiveContainer width="100%" height={240}>
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
          formatter={(value) => [`${value ?? ""} ${metric.unit}`, ""]}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#8993a4", paddingTop: 8 }}
        />

        <Line
          type="monotone"
          dataKey="Факт"
          stroke={factColor}
          strokeWidth={2}
          dot={{ r: 4, fill: factColor }}
          activeDot={{ r: 6 }}
        />

        {metric.type !== "range" && metric.plan_value != null && (
          <Line
            type="monotone"
            dataKey="План"
            stroke="#16a34a"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
          />
        )}

        {metric.type === "range" && (
          <>
            {metric.range_min != null && (
              <Line
                type="monotone"
                dataKey="Мін"
                stroke="#d97706"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
              />
            )}
            {metric.range_max != null && (
              <Line
                type="monotone"
                dataKey="Макс"
                stroke="#d97706"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
              />
            )}
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
