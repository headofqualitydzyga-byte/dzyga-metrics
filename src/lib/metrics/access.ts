import type { MetricDefinition } from "@/types/database";

// No next/headers import here — must be callable from both server
// components (cookie-based client) and the Telegram bot (admin client).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientLike = any;

export async function getAccessibleMetricIds(
  supabase: SupabaseClientLike,
  profileId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("profile_metric_access")
    .select("metric_definition_id")
    .eq("profile_id", profileId);
  return new Set(
    ((data ?? []) as Array<{ metric_definition_id: string }>).map(
      (r) => r.metric_definition_id
    )
  );
}

// admin sees everything unrestricted; every other role is limited to
// their explicitly granted metric set (opt-in allow-list, zero access
// until the admin grants some via the "Метрики" button on /admin/employees).
export function filterByAccess(
  metrics: MetricDefinition[],
  role: string,
  accessibleIds: Set<string>
): MetricDefinition[] {
  if (role === "admin") return metrics;
  return metrics.filter((m) => accessibleIds.has(m.id));
}
