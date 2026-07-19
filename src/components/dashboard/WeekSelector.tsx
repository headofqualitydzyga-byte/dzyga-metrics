"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentWeekStart, formatWeekStart, getWeekLabel } from "@/lib/metrics/status";

function getRecentWeeks(count = 8): string[] {
  const weeks: string[] = [];
  const current = getCurrentWeekStart();
  for (let i = 0; i < count; i++) {
    const d = new Date(current);
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
