"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { MetricDefinition, MetricSubmission } from "@/types/database";

export default function MetricSparkline({
  metric,
  submissions,
}: {
  metric: MetricDefinition;
  submissions: MetricSubmission[];
}) {
  const data = [...submissions]
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .map((s) => ({ value: s.value }));

  if (data.length < 2) return null;

  const color = metric.type === "declining" ? "#e5672a" : "#3b82f6";

  return (
    <div className="h-8 w-20 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
