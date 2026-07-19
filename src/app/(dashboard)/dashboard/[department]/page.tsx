import { notFound, redirect } from "next/navigation";
import { requireProfile, canSeeAllDepartments } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentWeekStart,
  formatWeekStart,
} from "@/lib/metrics/status";
import DepartmentDashboard from "@/components/dashboard/DepartmentDashboard";
import type { MetricDefinition, MetricSubmission } from "@/types/database";

export default async function DepartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ week?: string; period?: string }>;
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

  const weekStart = sp.week ?? formatWeekStart(getCurrentWeekStart());
  const period = (sp.period as "week" | "month" | "quarter") ?? "month";
  const cutoff = formatWeekStart(new Date(Date.now() - 24 * 7 * 24 * 60 * 60 * 1000));

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

  const defs = (metricsRaw ?? []) as MetricDefinition[];
  const metricIds = defs.map((m) => m.id);

  const [{ data: weekSubsRaw }, { data: chartSubsRaw }] = await Promise.all([
    metricIds.length
      ? supabase
          .from("metric_submissions")
          .select("*")
          .eq("week_start", weekStart)
          .in("metric_definition_id", metricIds)
      : Promise.resolve({ data: [] }),
    metricIds.length
      ? supabase
          .from("metric_submissions")
          .select("*")
          .gte("week_start", cutoff)
          .in("metric_definition_id", metricIds)
          .order("week_start")
      : Promise.resolve({ data: [] }),
  ]);

  const weekSubs = (weekSubsRaw ?? []) as MetricSubmission[];
  const chartSubs = (chartSubsRaw ?? []) as MetricSubmission[];

  return (
    <DepartmentDashboard
      department={department}
      metrics={defs}
      weekSubmissions={weekSubs}
      chartSubmissions={chartSubs}
      weekStart={weekStart}
      period={period}
      managerName={
        (managerProfile as { full_name: string | null; email: string } | null)?.full_name ??
        (managerProfile as { full_name: string | null; email: string } | null)?.email ??
        null
      }
      canSubmitWeb={
        profile.role === "manager" && profile.department_id === deptId
      }
    />
  );
}
