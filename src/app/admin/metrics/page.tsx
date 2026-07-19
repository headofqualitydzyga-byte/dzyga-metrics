import { createClient } from "@/lib/supabase/server";
import MetricsClient from "./metrics-client";

export default async function MetricsPage() {
  const supabase = await createClient();

  const [{ data: departments }, { data: metrics }] = await Promise.all([
    supabase.from("departments").select("id, name, color").order("sort_order"),
    supabase
      .from("metric_definitions")
      .select("*")
      .order("sort_order"),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink">Метрики</h1>
        <p className="mt-1 text-sm text-muted">
          Визначення метрик по відділам
        </p>
      </div>
      <MetricsClient
        departments={departments ?? []}
        metrics={metrics ?? []}
      />
    </div>
  );
}
