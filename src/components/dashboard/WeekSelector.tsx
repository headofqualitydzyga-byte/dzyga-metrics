"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { getPreviousWeekStart, formatWeekStart, getWeekLabel } from "@/lib/metrics/status";

// Starts from the last completed week, not the in-progress current one —
// metrics are reported for the week that just ended.
function getRecentWeeks(count = 8): string[] {
  const weeks: string[] = [];
  const previous = getPreviousWeekStart();
  for (let i = 0; i < count; i++) {
    const d = new Date(previous);
    d.setDate(d.getDate() - i * 7);
    weeks.push(formatWeekStart(d));
  }
  return weeks;
}

export default function WeekSelector({ currentWeek }: { currentWeek: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("week", e.target.value);
    router.push(`?${params.toString()}`);
  }

  const weeks = getRecentWeeks();

  return (
    <select
      value={currentWeek}
      onChange={handleChange}
      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
    >
      {weeks.map((w) => (
        <option key={w} value={w}>
          {getWeekLabel(w)}
        </option>
      ))}
    </select>
  );
}
