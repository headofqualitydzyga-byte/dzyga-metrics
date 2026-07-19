import { redirect } from "next/navigation";
import { requireProfile, canSeeAllDepartments } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calcStatus, getCurrentWeekStart, formatWeekStart, getWeekLabel } from "@/lib/metrics/status";
import DepartmentCard from "@/components/dashboard/DepartmentCard";
import WeekSelector from "@/components/dashboard/WeekSelector";
import type { Department, MetricDefinition, MetricSubmission } from "@/types/database";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { profile } = await requireProfile();
  const params = await searchParams;

  // Managers see only their own department
  if (!canSeeAllDepartments(profile.role)) {
    if (profile.department_id) {
      redirect(`/dashboard/${profile.department_id}`);
    } else {
      return (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted">
            Ваш профіль ще не прив'язаний до відділу. Зверніться до адміністратора.
          </p>
        </div>
      );
    }
  }

  const weekStart = params.week ?? formatWeekStart(getCurrentWeekStart());
  const supabase = await createClient();

  const [{ data: departments }, { data: metrics }, { data: submissions }] =
    await Promise.all([
      supabase.from("departments").select("*").order("sort_order"),
      supabase
        .from("metric_definitions")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("metric_submissions")
        .select("*")
        .eq("week_start", weekStart),
    ]);

  const depts = (departments ?? []) as Department[];
  const defs = (metrics ?? []) as MetricDefinition[];
  const subs = (submissions ?? []) as MetricSubmission[];

  // Aggregate status counts
  let normal = 0, warning = 0, critical = 0, notSubmitted = 0;
  for (const def of defs) {
    const sub = subs.find((s) => s.metric_definition_id === def.id);
    const status = calcStatus(def, sub?.value ?? null);
    if (status === "normal") normal++;
    else if (status === "warning") warning++;
    else if (status === "critical") critical++;
    else notSubmitted++;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Дашборд</h1>
          <p className="mt-1 text-sm text-muted">
            Тиждень: {getWeekLabel(weekStart)}
          </p>
        </div>
        <WeekSelector currentWeek={weekStart} />
      </div>

      {/* Summary bar */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        {[
          { label: "Норма", value: normal, color: "text-status-normal", bg: "bg-green-50" },
          { label: "Увага", value: warning, color: "text-status-warning", bg: "bg-amber-50" },
          { label: "Критично", value: critical, color: "text-status-critical", bg: "bg-red-50" },
          { label: "Не здано", value: notSubmitted, color: "text-muted", bg: "bg-page" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border border-border ${s.bg} p-4`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Department grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {depts.map((dept) => {
          const deptDefs = defs.filter((d) => d.department_id === dept.id);
          const deptSubs = subs.filter((s) =>
            deptDefs.some((d) => d.id === s.metric_definition_id)
          );
          return (
            <DepartmentCard
              key={dept.id}
              department={dept}
              metrics={deptDefs}
              submissions={deptSubs}
              weekStart={weekStart}
            />
          );
        })}
      </div>
    </div>
  );
}
