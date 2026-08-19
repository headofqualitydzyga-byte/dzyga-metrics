"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function OcPeriodFilter({
  period,
}: {
  period: "week" | "month" | "quarter";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(p: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex gap-1">
      {(["week", "month", "quarter"] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => handleChange(p)}
          className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
            period === p ? "bg-accent text-white" : "text-muted hover:text-ink"
          }`}
        >
          {p === "week" ? "Тиждень" : p === "month" ? "Місяць" : "Квартал"}
        </button>
      ))}
    </div>
  );
}
