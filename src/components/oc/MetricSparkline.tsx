"use client";

import { useId } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { STATUS_COLOR } from "@/lib/metrics/status";
import type { MetricStatus, MetricSubmission } from "@/types/database";

export default function MetricSparkline({
  submissions,
  status,
}: {
  submissions: MetricSubmission[];
  status: MetricStatus;
}) {
  const gradientId = `spark-${useId().replace(/:/g, "")}`;

  const data = [...submissions]
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .map((s) => ({ value: s.value }));

  if (data.length < 2) return null;

  const color = STATUS_COLOR[status];

  return (
    <div className="h-8 w-20 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
