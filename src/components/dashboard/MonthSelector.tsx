"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentMonthStart, formatWeekStart, getMonthLabel } from "@/lib/metrics/status";

function getRecentMonths(count = 12): string[] {
  const months: string[] = [];
  const current = getCurrentMonthStart();
  for (let i = 0; i < count; i++) {
    const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
    months.push(formatWeekStart(d));
  }
  return months;
}

export default function MonthSelector({ currentMonth }: { currentMonth: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", e.target.value);
    router.push(`?${params.toString()}`);
  }

  const months = getRecentMonths();

  return (
    <select
      value={currentMonth}
      onChange={handleChange}
      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
    >
      {months.map((m) => (
        <option key={m} value={m}>
          {getMonthLabel(m)}
        </option>
      ))}
    </select>
  );
}
