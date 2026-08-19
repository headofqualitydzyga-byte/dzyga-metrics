"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  BusinessLine,
  MetricDefinition,
  MetricFrequency,
  MetricType,
  ValueType,
} from "@/types/database";

const TYPE_LABELS: Record<MetricType, string> = {
  growing: "Зростаючий ↗",
  declining: "Спадний ↘",
  range: "Коридор ↔",
};

const VALUE_TYPE_LABELS: Record<ValueType, string> = {
  percent: "Відсоток (%)",
  number: "Число",
  boolean: "Так/Ні",
};

const FREQUENCY_LABELS: Record<MetricFrequency, string> = {
  weekly: "Щотижнева",
  monthly: "Щомісячна",
};

const BUSINESS_LINE_LABELS: Record<BusinessLine, string> = {
  catering: "Кейтеринг",
  boxes: "Бокси",
};

function MetricForm({
  initial,
  departmentId,
  defaultSortOrder,
  onSave,
  onCancel,
}: {
  initial?: Partial<MetricDefinition>;
  departmentId: string;
  defaultSortOrder: number;
  onSave: (data: Partial<MetricDefinition>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<MetricType>(initial?.type ?? "growing");
  const [valueType, setValueType] = useState<ValueType>(
    initial?.value_type ?? "percent"
  );
  const [frequency, setFrequency] = useState<MetricFrequency>(
    initial?.frequency ?? "weekly"
  );
  const [businessLine, setBusinessLine] = useState<BusinessLine>(
    initial?.business_line ?? "catering"
  );
  const [unit, setUnit] = useState(initial?.unit ?? "%");
  const [planValue, setPlanValue] = useState(
    initial?.plan_value?.toString() ?? ""
  );
  const [rangeMin, setRangeMin] = useState(
    initial?.range_min?.toString() ?? ""
  );
  const [rangeMax, setRangeMax] = useState(
    initial?.range_max?.toString() ?? ""
  );
  const [warningThreshold, setWarningThreshold] = useState(
    initial?.warning_threshold?.toString() ?? "10"
  );
  const [criticalThreshold, setCriticalThreshold] = useState(
    initial?.critical_threshold?.toString() ?? "20"
  );
  const [sortOrder, setSortOrder] = useState(
    (initial?.sort_order ?? defaultSortOrder).toString()
  );
  const [planRecurring, setPlanRecurring] = useState(
    initial?.plan_recurring ?? false
  );
  const [showInOc, setShowInOc] = useState(initial?.show_in_oc ?? false);
  const [ocFeatured, setOcFeatured] = useState(initial?.oc_featured ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Назва обов'язкова");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSave({
        department_id: departmentId,
        name: name.trim(),
        description: description.trim() || null,
        type,
        value_type: valueType,
        frequency,
        business_line: businessLine,
        unit: unit.trim() || "%",
        plan_value: planValue ? parseFloat(planValue) : null,
        range_min: rangeMin ? parseFloat(rangeMin) : null,
        range_max: rangeMax ? parseFloat(rangeMax) : null,
        warning_threshold: parseFloat(warningThreshold) || 10,
        critical_threshold: parseFloat(criticalThreshold) || 20,
        sort_order: parseInt(sortOrder, 10) || defaultSortOrder,
        plan_recurring: type !== "range" && planRecurring,
        show_in_oc: showInOc,
        oc_featured: showInOc && ocFeatured,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Помилка збереження");
    } finally {
      setLoading(false);
    }
  }

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    type = "text",
    placeholder = ""
  ) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field("Назва метрики", name, setName, "text", "Назва")}
        {field("Одиниця виміру", unit, setUnit, "text", "%, грн, бал, x")}
      </div>
      {field("Опис", description, setDescription, "text", "Необов'язково")}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">
            Тип метрики
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MetricType)}
            className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">
            Тип значення
          </label>
          <select
            value={valueType}
            onChange={(e) => setValueType(e.target.value as ValueType)}
            className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {Object.entries(VALUE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">
            Частота
          </label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as MetricFrequency)}
            className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">
            Напрямок
          </label>
          <select
            value={businessLine}
            onChange={(e) => setBusinessLine(e.target.value as BusinessLine)}
            className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {Object.entries(BUSINESS_LINE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {type !== "range" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field("Планове значення", planValue, setPlanValue, "number", "напр. 100")}
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={planRecurring}
              onChange={(e) => setPlanRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            {frequency === "monthly"
              ? "Оновлювати планове значення щомісяця"
              : "Оновлювати планове значення щотижня"}
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {field("Мінімум (нижня межа)", rangeMin, setRangeMin, "number", "напр. 28")}
          {field("Максимум (верхня межа)", rangeMax, setRangeMax, "number", "напр. 35")}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {field("Поріг Увага (% відхилення)", warningThreshold, setWarningThreshold, "number", "10")}
        {field("Поріг Критично (% відхилення)", criticalThreshold, setCriticalThreshold, "number", "20")}
        {field("Порядковий номер", sortOrder, setSortOrder, "number", "1")}
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={showInOc}
            onChange={(e) => {
              setShowInOc(e.target.checked);
              if (!e.target.checked) setOcFeatured(false);
            }}
            className="h-4 w-4 rounded border-border"
          />
          Показувати в Операційному центрі
        </label>
        <label className="flex items-center gap-2 pl-6 text-sm text-ink">
          <input
            type="checkbox"
            checked={ocFeatured}
            disabled={!showInOc}
            onChange={(e) => setOcFeatured(e.target.checked)}
            className="h-4 w-4 rounded border-border disabled:opacity-40"
          />
          Виводити у верхній блок (ключові показники)
        </label>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {loading ? "Збереження..." : "Зберегти"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-ink transition-colors"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}

export default function MetricsClient({
  departments,
  metrics: initialMetrics,
}: {
  departments: { id: string; name: string; color: string }[];
  metrics: MetricDefinition[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [metrics, setMetrics] = useState(initialMetrics);
  const [selectedDept, setSelectedDept] = useState<string | "all">("all");
  const [adding, setAdding] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered =
    selectedDept === "all"
      ? metrics
      : metrics.filter((m) => m.department_id === selectedDept);

  async function handleAdd(deptId: string, data: Partial<MetricDefinition>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error } = await (supabase as any)
      .from("metric_definitions")
      .insert({
        name: data.name,
        description: data.description,
        type: data.type,
        value_type: data.value_type,
        frequency: data.frequency,
        business_line: data.business_line,
        unit: data.unit,
        plan_value: data.plan_value,
        range_min: data.range_min,
        range_max: data.range_max,
        warning_threshold: data.warning_threshold,
        critical_threshold: data.critical_threshold,
        is_active: data.is_active ?? true,
        department_id: deptId,
        sort_order:
          data.sort_order ??
          metrics.filter((m) => m.department_id === deptId).length + 1,
        plan_recurring: data.plan_recurring ?? false,
        show_in_oc: data.show_in_oc ?? false,
        oc_featured: data.oc_featured ?? false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setMetrics((prev) => [...prev, created as MetricDefinition]);
    setAdding(null);
    router.refresh();
  }

  async function handleEdit(id: string, data: Partial<MetricDefinition>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error } = await (supabase as any)
      .from("metric_definitions")
      .update({
        name: data.name,
        description: data.description,
        type: data.type,
        value_type: data.value_type,
        frequency: data.frequency,
        business_line: data.business_line,
        unit: data.unit,
        plan_value: data.plan_value,
        range_min: data.range_min,
        range_max: data.range_max,
        warning_threshold: data.warning_threshold,
        critical_threshold: data.critical_threshold,
        sort_order: data.sort_order,
        plan_recurring: data.plan_recurring ?? false,
        show_in_oc: data.show_in_oc ?? false,
        oc_featured: data.oc_featured ?? false,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    setMetrics((prev) => prev.map((m) => (m.id === id ? (updated as MetricDefinition) : m)));
    setEditId(null);
    router.refresh();
  }

  async function handleToggleActive(m: MetricDefinition) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error } = await (supabase as any)
      .from("metric_definitions")
      .update({ is_active: !m.is_active })
      .eq("id", m.id)
      .select()
      .single();
    if (error) return;
    setMetrics((prev) => prev.map((x) => (x.id === m.id ? (updated as MetricDefinition) : x)));
  }

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from("metric_definitions")
      .delete()
      .eq("id", id);
    if (error) return;
    setMetrics((prev) => prev.filter((m) => m.id !== id));
    setDeleteId(null);
    router.refresh();
  }

  const deptName = (id: string) =>
    departments.find((d) => d.id === id)?.name ?? "—";
  const deptColor = (id: string) =>
    departments.find((d) => d.id === id)?.color ?? "#6366f1";

  return (
    <div className="flex flex-col gap-4">
      {/* Dept filter */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedDept("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            selectedDept === "all"
              ? "bg-accent text-white"
              : "border border-border text-muted hover:text-ink"
          }`}
        >
          Всі
        </button>
        {departments.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setSelectedDept(d.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedDept === d.id
                ? "text-white"
                : "border border-border text-muted hover:text-ink"
            }`}
            style={
              selectedDept === d.id ? { backgroundColor: d.color } : undefined
            }
          >
            {d.name}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-page">
              <th className="px-4 py-3 text-left font-medium text-muted">№</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Метрика</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Відділ</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Тип</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Частота</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Напрямок</th>
              <th className="px-4 py-3 text-left font-medium text-muted">План</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Статус</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <Fragment key={m.id}>
                <tr
                  className={`border-b border-border last:border-0 hover:bg-page ${
                    !m.is_active ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-muted">{m.sort_order}</td>
                  <td className="px-4 py-3 font-medium text-ink">
                    {m.name}
                    {m.show_in_oc && (
                      <span title="Показується в Операційному центрі" className="ml-1">
                        🎯
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: deptColor(m.department_id) }}
                    >
                      {deptName(m.department_id)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{TYPE_LABELS[m.type]}</td>
                  <td className="px-4 py-3 text-muted">{FREQUENCY_LABELS[m.frequency]}</td>
                  <td className="px-4 py-3 text-muted">{BUSINESS_LINE_LABELS[m.business_line]}</td>
                  <td className="px-4 py-3 text-muted">
                    {m.type === "range"
                      ? `${m.range_min ?? "?"} – ${m.range_max ?? "?"} ${m.unit}`
                      : m.plan_value != null
                      ? `${m.plan_value} ${m.unit}`
                      : "—"}
                    {m.plan_recurring && (
                      <span
                        title={
                          m.frequency === "monthly"
                            ? "Оновлюється щомісяця"
                            : "Оновлюється щотижня"
                        }
                      >
                        {" "}
                        🔄
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(m)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        m.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-page text-muted"
                      }`}
                    >
                      {m.is_active ? "Активна" : "Прихована"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditId(m.id)}
                        className="text-sm text-accent hover:underline"
                      >
                        Ред.
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(m.id)}
                        className="text-sm text-red-500 hover:underline"
                      >
                        Видалити
                      </button>
                    </div>
                  </td>
                </tr>
                {editId === m.id && (
                  <tr className="border-b border-border bg-page">
                    <td colSpan={9} className="px-4 py-4">
                      <MetricForm
                        initial={m}
                        departmentId={m.department_id}
                        defaultSortOrder={m.sort_order}
                        onSave={(data) => handleEdit(m.id, data)}
                        onCancel={() => setEditId(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">
            Немає метрик. Виберіть відділ і додайте першу.
          </p>
        )}
      </div>

      {/* Add metric per dept */}
      <div className="flex flex-wrap gap-2">
        {departments
          .filter((d) => selectedDept === "all" || selectedDept === d.id)
          .map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setAdding(d.id)}
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:border-accent hover:text-ink transition-colors"
            >
              + Метрика для «{d.name}»
            </button>
          ))}
      </div>

      {adding && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink">
            Нова метрика — {deptName(adding)}
          </h2>
          <MetricForm
            departmentId={adding}
            defaultSortOrder={
              metrics.filter((m) => m.department_id === adding).length + 1
            }
            onSave={(data) => handleAdd(adding, data)}
            onCancel={() => setAdding(null)}
          />
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-xl">
            <h2 className="mb-2 text-base font-semibold text-ink">
              Видалити метрику?
            </h2>
            <p className="mb-6 text-sm text-muted">
              Вся історія submissions буде видалена разом з метрикою.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleDelete(deleteId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Видалити
              </button>
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-ink transition-colors"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
