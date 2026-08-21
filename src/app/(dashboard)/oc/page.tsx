import { redirect } from "next/navigation";
import { requireProfile, canSeeAllDepartments } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getPreviousWeekStart,
  getCurrentMonthStart,
  getPriorPeriodStart,
  formatWeekStart,
} from "@/lib/metrics/status";
import { getAccessibleMetricIds, filterByAccess } from "@/lib/metrics/access";
import OcTopRow from "@/components/oc/OcTopRow";
import OcDepartmentCard from "@/components/oc/OcDepartmentCard";
import OcPeriodFilter from "@/components/oc/OcPeriodFilter";
import type { Department, MetricDefinition, MetricSubmission, Profile } from "@/types/database";

export default async function OcPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; line?: string }>;
}) {
  const { profile } = await requireProfile();
  if (!canSeeAllDepartments(profile.role)) redirect("/dashboard");

  const sp = await searchParams;
  const period: "week" | "month" | "quarter" =
    sp.period === "week" || sp.period === "quarter" ? sp.period : "month";
  const line: "catering" | "boxes" | "all" =
    sp.line === "catering" || sp.line === "boxes" ? sp.line : "all";

  const supabase = await createClient();

  const [{ data: departmentsRaw }, { data: defsRaw }, { data: managersRaw }] =
    await Promise.all([
      supabase.from("departments").select("*").order("sort_order"),
      supabase
        .from("metric_definitions")
        .select("*")
        .eq("is_active", true)
        .eq("show_in_oc", true),
      supabase.from("profiles").select("*").eq("role", "manager"),
    ]);

  const departments = (departmentsRaw ?? []) as Department[];
  let defs = (defsRaw ?? []) as MetricDefinition[];

  if (profile.role !== "admin") {
    const accessibleIds = await getAccessibleMetricIds(supabase, profile.id);
    defs = filterByAccess(defs, profile.role, accessibleIds);
  }

  const hasCatering = defs.some((d) => d.business_line === "catering");
  const hasBoxes = defs.some((d) => d.business_line === "boxes");
  const lineDefs = line === "all" ? defs : defs.filter((d) => d.business_line === line);

  const managers = (managersRaw ?? []) as Profile[];
  const responsibleByDept = new Map<string, string>();
  for (const m of managers) {
    if (m.department_id) responsibleByDept.set(m.department_id, m.full_name ?? m.email);
  }

  const weekStart = formatWeekStart(getPreviousWeekStart());
  const monthStart = formatWeekStart(getCurrentMonthStart());
  const priorWeekStart = getPriorPeriodStart("weekly", weekStart);
  const priorMonthStart = getPriorPeriodStart("monthly", monthStart);

  const defIds = defs.map((d) => d.id);
  const { data: subsRaw } = defIds.length
    ? await supabase
        .from("metric_submissions")
        .select("*")
        .in("metric_definition_id", defIds)
        .in("week_start", [weekStart, monthStart, priorWeekStart, priorMonthStart])
    : { data: [] };
  const subs = (subsRaw ?? []) as MetricSubmission[];

  const current = new Map<string, number>();
  const prior = new Map<string, number>();
  for (const def of defs) {
    const currentKey = def.frequency === "monthly" ? monthStart : weekStart;
    const priorKey = def.frequency === "monthly" ? priorMonthStart : priorWeekStart;
    const currentSub = subs.find(
      (s) => s.metric_definition_id === def.id && s.week_start === currentKey
    );
    const priorSub = subs.find(
      (s) => s.metric_definition_id === def.id && s.week_start === priorKey
    );
    if (currentSub) current.set(def.id, currentSub.value);
    if (priorSub) prior.set(def.id, priorSub.value);
  }

  // Sparkline lookback window — same weeks-back scale as MetricChart, just
  // rendered compact instead of a full axis/legend chart.
  const weeksBack = period === "week" ? 8 : period === "month" ? 16 : 24;
  const cutoff = formatWeekStart(
    new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000)
  );

  const { data: chartSubsRaw } = defIds.length
    ? await supabase
        .from("metric_submissions")
        .select("*")
        .in("metric_definition_id", defIds)
        .gte("week_start", cutoff)
        .order("week_start")
    : { data: [] };
  const chartSubs = (chartSubsRaw ?? []) as MetricSubmission[];

  const chartByMetric = new Map<string, MetricSubmission[]>();
  for (const def of defs) {
    chartByMetric.set(
      def.id,
      chartSubs.filter((s) => s.metric_definition_id === def.id)
    );
  }

  const featured = lineDefs.filter((d) => d.oc_featured);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink">Операційний центр</h1>
        <p className="mt-1 text-sm text-muted">
          Ключові показники за поточний звітний період
        </p>
      </div>

      <OcPeriodFilter period={period} />

      {/* Catering / boxes toggle — only shown when the OC-flagged metrics mix both */}
      {hasCatering && hasBoxes && (
        <div className="mb-4 flex gap-1">
          {(["all", "catering", "boxes"] as const).map((l) => {
            const qs = new URLSearchParams();
            qs.set("period", period);
            qs.set("line", l);
            return (
              <a
                key={l}
                href={`?${qs.toString()}`}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  line === l ? "bg-accent text-white" : "text-muted hover:text-ink"
                }`}
              >
                {l === "all" ? "Усі" : l === "catering" ? "Кейтеринг" : "Бокси"}
              </a>
            );
          })}
        </div>
      )}

      {featured.length > 0 && (
        <OcTopRow
          metrics={featured}
          current={current}
          prior={prior}
          chartByMetric={chartByMetric}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => (
          <OcDepartmentCard
            key={dept.id}
            department={dept}
            metrics={lineDefs.filter((d) => d.department_id === dept.id)}
            current={current}
            prior={prior}
            chartByMetric={chartByMetric}
            responsibleName={responsibleByDept.get(dept.id) ?? null}
          />
        ))}
      </div>
    </div>
  );
}
