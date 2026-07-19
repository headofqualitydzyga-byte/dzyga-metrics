"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Department } from "@/types/database";

const DEPT_COLORS = [
  "#3b82f6", "#16a34a", "#8b5cf6", "#f59e0b", "#6366f1",
  "#0ea5e9", "#e5672a", "#64748b", "#059669", "#dc2626",
  "#ec4899", "#14b8a6",
];

const DEPT_ICONS = [
  "megaphone", "cart", "star", "users", "cog", "truck",
  "clipboard", "document", "currency", "chart", "shield", "home",
];

function DeptForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Department>;
  onSave: (data: Partial<Department>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? "#6366f1");
  const [icon, setIcon] = useState(initial?.icon ?? "chart");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Назва обов'язкова"); return; }
    setLoading(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), description: description.trim() || null, color, icon });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Помилка збереження");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Назва</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          placeholder="Назва відділу"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Опис</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          placeholder="Короткий опис (необов'язково)"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Колір</label>
        <div className="flex flex-wrap gap-2">
          {DEPT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-7 w-7 rounded-full border-2 transition-all"
              style={{
                backgroundColor: c,
                borderColor: color === c ? "#1f2733" : "transparent",
              }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-7 w-7 cursor-pointer rounded-full border border-border"
            title="Власний колір"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Іконка</label>
        <div className="flex flex-wrap gap-2">
          {DEPT_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setIcon(ic)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                icon === ic
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-muted hover:border-accent hover:text-ink"
              }`}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
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

export default function DepartmentsClient({
  departments: initial,
}: {
  departments: Department[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [departments, setDepartments] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function handleAdd(data: Partial<Department>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error } = await (supabase as any)
      .from("departments")
      .insert({ name: data.name, description: data.description, color: data.color, icon: data.icon, sort_order: departments.length + 1 })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setDepartments((prev) => [...prev, created as Department]);
    setAdding(false);
    router.refresh();
  }

  async function handleEdit(id: string, data: Partial<Department>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error } = await (supabase as any)
      .from("departments")
      .update({ name: data.name, description: data.description, color: data.color, icon: data.icon })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    setDepartments((prev) => prev.map((d) => (d.id === id ? updated : d)));
    setEditId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setDepartments((prev) => prev.filter((d) => d.id !== id));
    setDeleteId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-page">
              <th className="px-4 py-3 text-left font-medium text-muted">Назва</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Колір</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Іконка</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Порядок</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => (
              <>
                <tr key={dept.id} className="border-b border-border last:border-0 hover:bg-page">
                  <td className="px-4 py-3 font-medium text-ink">{dept.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block h-5 w-5 rounded-full"
                      style={{ backgroundColor: dept.color }}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted">{dept.icon}</td>
                  <td className="px-4 py-3 text-muted">{dept.sort_order}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditId(dept.id)}
                        className="text-sm text-accent hover:underline"
                      >
                        Редагувати
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(dept.id)}
                        className="text-sm text-red-500 hover:underline"
                      >
                        Видалити
                      </button>
                    </div>
                  </td>
                </tr>
                {editId === dept.id && (
                  <tr key={`edit-${dept.id}`} className="border-b border-border bg-page">
                    <td colSpan={5} className="px-4 py-4">
                      <DeptForm
                        initial={dept}
                        onSave={(data) => handleEdit(dept.id, data)}
                        onCancel={() => setEditId(null)}
                      />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {departments.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">
            Немає відділів. Додайте перший.
          </p>
        )}
      </div>

      {adding ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink">Новий відділ</h2>
          <DeptForm onSave={handleAdd} onCancel={() => setAdding(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
        >
          + Додати відділ
        </button>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-xl">
            <h2 className="mb-2 text-base font-semibold text-ink">Видалити відділ?</h2>
            <p className="mb-6 text-sm text-muted">
              Всі метрики та дані цього відділу будуть видалені. Цю дію не можна скасувати.
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
