import { notFound, redirect } from "next/navigation";
import { requireProfile, canSeeAllDepartments } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getPreviousWeekStart,
  getCurrentMonthStart,
  getMonthLabel,
  getWeekLabel,
  formatWeekStart,
} from "@/lib/metrics/status";
import { getAccessibleMetricIds, filterByAccess } from "@/lib/metrics/access";
import DepartmentDashboard from "@/components/dashboard/DepartmentDashboard";
import type { MetricDefinition, MetricSubmission } from "@/types/database";

export default async function DepartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams: Promise<{
    week?: string;
    month?: string;
    view?: string;
    line?: string;
    period?: string;
    fixedLine?: string;
  }>;
}) {
  const { profile } = await requireProfile();
  const { department: deptId } = await params;
  const sp = await searchParams;

  if (!canSeeAllDepartments(profile.role)) {
    if (profile.department_id !== deptId) {
      redirect(
        profile.department_id ? `/dashboard/${profile.department_id}` : "/dashboard"
      );
    }
  }

  const weekStart = sp.week ?? formatWeekStart(getPreviousWeekStart());
  const monthStart = sp.month ?? formatWeekStart(getCurrentMonthStart());
  const period = (sp.period as "week" | "month" | "quarter") ?? "month";
  // Widened from 24 weeks so monthly metrics (1 data point per month) have
  // enough history for the chart's lookback toggle.
  const cutoff = formatWeekStart(new Date(Date.now() - 52 * 7 * 24 * 60 * 60 * 1000));

  const supabase = await createClient();

  const [
    { data: department },
    { data: metricsRaw },
    { data: managerProfile },
  ] = await Promise.all([
    supabase.from("departments").select("*").eq("id", deptId).single(),
    supabase
      .from("metric_definitions")
      .select("*")
      .eq("department_id", deptId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("department_id", deptId)
      .eq("role", "manager")
      .maybeSingle(),
  ]);

  if (!department) notFound();

  let defs = (metricsRaw ?? []) as MetricDefinition[];

  if (profile.role !== "admin") {
    const accessibleIds = await getAccessibleMetricIds(supabase, profile.id);
    defs = filterByAccess(defs, profile.role, accessibleIds);
  }

  const hasCatering = defs.some((d) => d.business_line === "catering");
  const hasBoxes = defs.some((d) => d.business_line === "boxes");
  const line: "catering" | "boxes" | "all" =
    sp.line === "catering" || sp.line === "boxes" ? sp.line : "all";
  const lineDefs = line === "all" ? defs : defs.filter((d) => d.business_line === line);

  const weeklyDefs = lineDefs.filter((d) => d.frequency === "weekly");
  const monthlyDefs = lineDefs.filter((d) => d.frequency === "monthly");
  const hasWeekly = weeklyDefs.length > 0;
  const hasMonthly = monthlyDefs.length > 0;

  const view: "weekly" | "monthly" =
    sp.view === "monthly" || (!hasWeekly && hasMonthly) ? "monthly" : "weekly";

  const activeMetrics = view === "monthly" ? monthlyDefs : weeklyDefs;
  const activePeriodStart = view === "monthly" ? monthStart : weekStart;
  const activeMetricIds = activeMetrics.map((m) => m.id);

  const [{ data: periodSubsRaw }, { data: chartSubsRaw }] = await Promise.all([
    activeMetricIds.length
      ? supabase
          .from("metric_submissions")
          .select("*")
          .eq("week_start", activePeriodStart)
          .in("metric_definition_id", activeMetricIds)
      : Promise.resolve({ data: [] }),
    activeMetricIds.length
      ? supabase
          .from("metric_submissions")
          .select("*")
          .gte("week_start", cutoff)
          .in("metric_definition_id", activeMetricIds)
          .order("week_start")
      : Promise.resolve({ data: [] }),
  ]);

  const periodSubs = (periodSubsRaw ?? []) as MetricSubmission[];
  const chartSubs = (chartSubsRaw ?? []) as MetricSubmission[];

  const periodLabel =
    view === "monthly" ? getMonthLabel(activePeriodStart) : getWeekLabel(activePeriodStart);

  return (
    <DepartmentDashboard
      key={`${view}-${line}-${activePeriodStart}`}
      department={department}
      metrics={activeMetrics}
      weekSubmissions={periodSubs}
      chartSubmissions={chartSubs}
      weekStart={activePeriodStart}
      periodLabel={periodLabel}
      view={view}
      hasWeekly={hasWeekly}
      hasMonthly={hasMonthly}
      line={line}
      hasCatering={hasCatering}
      hasBoxes={hasBoxes}
      hideLineToggle={sp.fixedLine === "1"}
      period={period}
      managerName={
        (managerProfile as { full_name: string | null; email: string } | null)?.full_name ??
        (managerProfile as { full_name: string | null; email: string } | null)?.email ??
        null
      }
      canSubmitWeb={
        (profile.role === "manager" && profile.department_id === deptId) ||
        profile.role === "admin" ||
        (profile.role === "viewer" && activeMetrics.length > 0)
      }
    />
  );
}
