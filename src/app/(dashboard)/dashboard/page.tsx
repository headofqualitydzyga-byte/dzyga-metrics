import { redirect } from "next/navigation";
import { requireProfile, canSeeAllDepartments } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  calcStatus,
  getPreviousWeekStart,
  getCurrentMonthStart,
  formatWeekStart,
  getWeekLabel,
  getMonthLabel,
} from "@/lib/metrics/status";
import { getAccessibleMetricIds, filterByAccess } from "@/lib/metrics/access";
import DepartmentCard from "@/components/dashboard/DepartmentCard";
import WeekSelector from "@/components/dashboard/WeekSelector";
import MonthSelector from "@/components/dashboard/MonthSelector";
import type { Department, MetricDefinition, MetricSubmission } from "@/types/database";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; month?: string; view?: string; line?: string }>;
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

  const weekStart = params.week ?? formatWeekStart(getPreviousWeekStart());
  const monthStart = params.month ?? formatWeekStart(getCurrentMonthStart());
  const view: "weekly" | "monthly" = params.view === "monthly" ? "monthly" : "weekly";
  const activePeriodStart = view === "monthly" ? monthStart : weekStart;

  const supabase = await createClient();

  const [{ data: departments }, { data: metrics }] = await Promise.all([
    supabase.from("departments").select("*").order("sort_order"),
    supabase
      .from("metric_definitions")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const depts = (departments ?? []) as Department[];
  let defs = (metrics ?? []) as MetricDefinition[];

  if (profile.role !== "admin") {
    const accessibleIds = await getAccessibleMetricIds(supabase, profile.id);
    defs = filterByAccess(defs, profile.role, accessibleIds);
  }

  const hasCatering = defs.some((d) => d.business_line === "catering");
  const hasBoxes = defs.some((d) => d.business_line === "boxes");
  const line: "catering" | "boxes" | "all" =
    params.line === "catering" || params.line === "boxes" ? params.line : "all";
  const lineDefs = line === "all" ? defs : defs.filter((d) => d.business_line === line);

  const activeDefs = lineDefs.filter((d) => d.frequency === view);
  const activeMetricIds = activeDefs.map((d) => d.id);

  const { data: submissions } = activeMetricIds.length
    ? await supabase
        .from("metric_submissions")
        .select("*")
        .eq("week_start", activePeriodStart)
        .in("metric_definition_id", activeMetricIds)
    : { data: [] };

  const subs = (submissions ?? []) as MetricSubmission[];

  // Aggregate status counts
  let normal = 0, warning = 0, critical = 0, notSubmitted = 0;
  for (const def of activeDefs) {
    const sub = subs.find((s) => s.metric_definition_id === def.id);
    const status = calcStatus(def, sub?.value ?? null);
    if (status === "normal") normal++;
    else if (status === "warning") warning++;
    else if (status === "critical") critical++;
    else notSubmitted++;
  }

  const periodLabel =
    view === "monthly" ? getMonthLabel(activePeriodStart) : getWeekLabel(activePeriodStart);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Дашборд</h1>
          <p className="mt-1 text-sm text-muted">
            {view === "monthly" ? "Місяць" : "Тиждень"}: {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {view === "monthly" ? (
            <MonthSelector currentMonth={monthStart} />
          ) : (
            <WeekSelector currentWeek={weekStart} />
          )}
        </div>
      </div>

      {/* Weekly / monthly toggle */}
      <div className="mb-4 flex gap-1">
        {(["weekly", "monthly"] as const).map((v) => {
          const qs = new URLSearchParams();
          qs.set("view", v);
          qs.set("week", weekStart);
          qs.set("month", monthStart);
          qs.set("line", line);
          return (
            <a
              key={v}
              href={`?${qs.toString()}`}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                view === v
                  ? "bg-accent text-white"
                  : "text-muted hover:text-ink"
              }`}
            >
              {v === "weekly" ? "Щотижневі" : "Щомісячні"}
            </a>
          );
        })}
      </div>

      {/* Catering / boxes toggle — only shown when there's a mix */}
      {hasCatering && hasBoxes && (
        <div className="mb-6 flex gap-1">
          {(["all", "catering", "boxes"] as const).map((l) => {
            const qs = new URLSearchParams();
            qs.set("view", view);
            qs.set("week", weekStart);
            qs.set("month", monthStart);
            qs.set("line", l);
            return (
              <a
                key={l}
                href={`?${qs.toString()}`}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  line === l
                    ? "bg-accent text-white"
                    : "text-muted hover:text-ink"
                }`}
              >
                {l === "all" ? "Усі" : l === "catering" ? "Кейтеринг" : "Бокси"}
              </a>
            );
          })}
        </div>
      )}

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
          const deptDefs = activeDefs.filter((d) => d.department_id === dept.id);
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
              monthStart={monthStart}
              view={view}
              line={line}
            />
          );
        })}
      </div>
    </div>
  );
}
