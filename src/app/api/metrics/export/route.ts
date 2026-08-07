import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ExcelJS from "exceljs";
import {
  calcStatus,
  formatDeviation,
  formatWeekStart,
  getCurrentWeekStart,
  getCurrentMonthStart,
} from "@/lib/metrics/status";
import type { MetricDefinition, MetricSubmission, Department } from "@/types/database";

export async function GET(req: NextRequest) {
  const { profile } = await requireProfile();
  const { searchParams } = new URL(req.url);
  const deptId = searchParams.get("department");
  const weekStart = searchParams.get("week") ?? formatWeekStart(getCurrentWeekStart());
  const monthStart = searchParams.get("month") ?? formatWeekStart(getCurrentMonthStart());

  const supabase = await createClient();

  const [{ data: departments }, { data: metrics }, { data: submissions }] =
    await Promise.all([
      supabase.from("departments").select("*").order("sort_order"),
      deptId
        ? supabase
            .from("metric_definitions")
            .select("*")
            .eq("department_id", deptId)
            .eq("is_active", true)
            .order("sort_order")
        : supabase
            .from("metric_definitions")
            .select("*")
            .eq("is_active", true)
            .order("sort_order"),
      supabase
        .from("metric_submissions")
        .select("*")
        .in("week_start", [weekStart, monthStart]),
    ]);

  const defs = (metrics ?? []) as MetricDefinition[];
  const subs = (submissions ?? []) as MetricSubmission[];
  const depts = (departments ?? []) as Department[];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Метрики");

  sheet.columns = [
    { header: "Відділ", key: "dept", width: 20 },
    { header: "Метрика", key: "name", width: 35 },
    { header: "Тип", key: "type", width: 12 },
    { header: "Частота", key: "frequency", width: 14 },
    { header: "План", key: "plan", width: 14 },
    { header: "Факт", key: "fact", width: 14 },
    { header: "Відхилення", key: "deviation", width: 18 },
    { header: "Статус", key: "status", width: 14 },
  ];

  // Style header
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF4F5F7" },
  };

  const typeLabels: Record<string, string> = {
    growing: "Зростаючий",
    declining: "Спадний",
    range: "Коридор",
  };
  const statusLabels: Record<string, string> = {
    normal: "Норма",
    warning: "Увага",
    critical: "Критично",
    not_submitted: "Не здано",
  };

  const frequencyLabels: Record<string, string> = {
    weekly: "Щотижнева",
    monthly: "Щомісячна",
  };

  for (const def of defs) {
    const dept = depts.find((d) => d.id === def.department_id);
    const periodStart = def.frequency === "monthly" ? monthStart : weekStart;
    const sub = subs.find(
      (s) => s.metric_definition_id === def.id && s.week_start === periodStart
    );
    const status = calcStatus(def, sub?.value ?? null);

    const row = sheet.addRow({
      dept: dept?.name ?? "—",
      name: def.name,
      type: typeLabels[def.type] ?? def.type,
      frequency: frequencyLabels[def.frequency] ?? def.frequency,
      plan:
        def.type === "range"
          ? `${def.range_min ?? "?"}–${def.range_max ?? "?"} ${def.unit}`
          : def.plan_value != null
          ? `${def.plan_value} ${def.unit}`
          : "—",
      fact: sub != null ? `${sub.value} ${def.unit}` : "—",
      deviation: sub != null ? formatDeviation(def, sub.value) : "—",
      status: statusLabels[status],
    });

    // Color status cell
    const statusCell = row.getCell("status");
    if (status === "normal") {
      statusCell.font = { color: { argb: "FF16A34A" } };
    } else if (status === "warning") {
      statusCell.font = { color: { argb: "FFD97706" } };
    } else if (status === "critical") {
      statusCell.font = { color: { argb: "FFDC2626" } };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `metrics-${weekStart}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
