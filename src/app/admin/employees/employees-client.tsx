"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/roles";
import type { Invitation, MetricDefinition, Profile, UserRole } from "@/types/database";

type ProfileWithDept = Profile & { departments: { name: string } | null };
type InvitationWithDept = Invitation & { departments: { name: string } | null };

function MetricAccessModal({
  profile,
  allMetrics,
  departments,
  onSave,
  onClose,
}: {
  profile: ProfileWithDept;
  allMetrics: MetricDefinition[];
  departments: { id: string; name: string }[];
  onSave: (metricIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("profile_metric_access")
      .select("metric_definition_id")
      .eq("profile_id", profile.id)
      .then(({ data }: { data: Array<{ metric_definition_id: string }> | null }) => {
        setSelected(new Set((data ?? []).map((r) => r.metric_definition_id)));
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    await onSave(Array.from(selected));
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-surface p-6 shadow-xl">
        <h2 className="mb-1 text-base font-semibold text-ink">
          Доступ до метрик — {profile.full_name ?? profile.email}
        </h2>
        <p className="mb-4 text-xs text-muted">
          Без жодної позначки співробітник не бачить жодної метрики.
        </p>
        <div className="flex-1 overflow-y-auto">
          {!loaded ? (
            <p className="text-sm text-muted">Завантаження...</p>
          ) : (
            departments.map((dept) => {
              const deptMetrics = allMetrics.filter((m) => m.department_id === dept.id);
              if (!deptMetrics.length) return null;
              const weekly = deptMetrics.filter((m) => m.frequency === "weekly");
              const monthly = deptMetrics.filter((m) => m.frequency === "monthly");
              return (
                <div key={dept.id} className="mb-4">
                  <h3 className="mb-2 text-sm font-semibold text-ink">{dept.name}</h3>
                  {weekly.length > 0 && (
                    <div className="mb-2">
                      <p className="mb-1 text-xs font-medium text-muted">Щотижневі</p>
                      {weekly.map((m) => (
                        <label
                          key={m.id}
                          className="flex items-center gap-2 py-1 text-sm text-ink"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(m.id)}
                            onChange={() => toggle(m.id)}
                          />
                          {m.name}
                        </label>
                      ))}
                    </div>
                  )}
                  {monthly.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted">Щомісячні</p>
                      {monthly.map((m) => (
                        <label
                          key={m.id}
                          className="flex items-center gap-2 py-1 text-sm text-ink"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(m.id)}
                            onChange={() => toggle(m.id)}
                          />
                          {m.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !loaded}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {saving ? "Збереження..." : "Зберегти"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-ink transition-colors"
          >
            Скасувати
          </button>
        </div>
      </div>
    </div>
  );
}

function TelegramModal({
  profile,
  onSave,
  onClose,
}: {
  profile: ProfileWithDept;
  onSave: (telegramId: string, username: string) => Promise<void>;
  onClose: () => void;
}) {
  const [telegramId, setTelegramId] = useState(profile.telegram_id ?? "");
  const [username, setUsername] = useState(profile.telegram_username ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onSave(telegramId.trim(), username.trim());
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold text-ink">
          Telegram для {profile.full_name ?? profile.email}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Telegram ID
            </label>
            <input
              type="text"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="123456789"
              className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Username (без @)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>
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
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-ink transition-colors"
            >
              Скасувати
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InvitationsSection({
  invitations: initial,
  departments,
}: {
  invitations: InvitationWithDept[];
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [invitations, setInvitations] = useState(initial);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("manager");
  const [deptId, setDeptId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const res = await fetch("/api/invite/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        role,
        department_id: deptId || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Помилка надсилання");
      setLoading(false);
      return;
    }

    setSuccess(`Запрошення надіслано на ${email}`);
    setEmail("");
    setDeptId("");
    setLoading(false);
    router.refresh();
  }

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">
          Надіслати запрошення
        </h2>
        <form onSubmit={handleSendInvite} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@dzyga.com"
                className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Роль
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Відділ
              </label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {success}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {loading ? "Надсилання..." : "Надіслати запрошення"}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-page">
              <th className="px-4 py-3 text-left font-medium text-muted">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Роль</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Відділ</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Статус</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Посилання</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => {
              const isExpired =
                !inv.accepted_at && new Date(inv.expires_at) < new Date();
              return (
                <tr
                  key={inv.id}
                  className="border-b border-border last:border-0 hover:bg-page"
                >
                  <td className="px-4 py-3 font-medium text-ink">{inv.email}</td>
                  <td className="px-4 py-3 text-muted">
                    {ROLE_LABELS[inv.role]}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {inv.departments?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {inv.accepted_at ? (
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs text-green-700">
                        Прийнято
                      </span>
                    ) : isExpired ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs text-red-600">
                        Прострочено
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-700">
                        Очікує
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!inv.accepted_at && !isExpired && (
                      <button
                        type="button"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            `${appUrl}/invite/${inv.token}`
                          )
                        }
                        className="text-xs text-accent hover:underline"
                      >
                        Скопіювати
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {invitations.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">
            Немає запрошень
          </p>
        )}
      </div>
    </div>
  );
}

export default function EmployeesClient({
  profiles: initial,
  departments,
  invitations,
  allMetrics,
}: {
  profiles: ProfileWithDept[];
  departments: { id: string; name: string }[];
  invitations: InvitationWithDept[];
  allMetrics: MetricDefinition[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [profiles, setProfiles] = useState(initial);
  const [telegramFor, setTelegramFor] = useState<ProfileWithDept | null>(null);
  const [metricAccessFor, setMetricAccessFor] = useState<ProfileWithDept | null>(null);

  async function handleRoleChange(id: string, role: UserRole) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("profiles").update({ role }).eq("id", id);
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, role } : p))
    );
    router.refresh();
  }

  async function handleDeptChange(id: string, deptId: string) {
    const dept = departments.find((d) => d.id === deptId) ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("profiles")
      .update({ department_id: deptId || null })
      .eq("id", id);
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, department_id: deptId || null, departments: dept ? { name: dept.name } : null }
          : p
      )
    );
    router.refresh();
  }

  async function handleTelegramSave(
    profileId: string,
    telegramId: string,
    username: string
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("profiles")
      .update({
        telegram_id: telegramId || null,
        telegram_username: username || null,
      })
      .eq("id", profileId);
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === profileId
          ? { ...p, telegram_id: telegramId || null, telegram_username: username || null }
          : p
      )
    );
    setTelegramFor(null);
    router.refresh();
  }

  async function handleMetricAccessSave(profileId: string, metricIds: string[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    await client.from("profile_metric_access").delete().eq("profile_id", profileId);
    if (metricIds.length > 0) {
      await client
        .from("profile_metric_access")
        .insert(metricIds.map((metricId) => ({ profile_id: profileId, metric_definition_id: metricId })));
    }
    setMetricAccessFor(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-page">
                <th className="px-4 py-3 text-left font-medium text-muted">Ім'я / Email</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Роль</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Відділ</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Telegram</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 hover:bg-page"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">
                      {p.full_name ?? "—"}
                    </div>
                    <div className="text-xs text-muted">{p.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={p.role}
                      onChange={(e) =>
                        handleRoleChange(p.id, e.target.value as UserRole)
                      }
                      className="rounded-lg border border-border bg-page px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
                    >
                      {Object.entries(ROLE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={p.department_id ?? ""}
                      onChange={(e) => handleDeptChange(p.id, e.target.value)}
                      className="rounded-lg border border-border bg-page px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
                    >
                      <option value="">—</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {p.telegram_id ? (
                      <span className="text-xs text-status-normal">
                        @{p.telegram_username ?? p.telegram_id}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Не прив'язано</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setMetricAccessFor(p)}
                        className="text-sm text-accent hover:underline"
                      >
                        Метрики
                      </button>
                      <button
                        type="button"
                        onClick={() => setTelegramFor(p)}
                        className="text-sm text-accent hover:underline"
                      >
                        Telegram
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {profiles.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Немає співробітників. Надішліть запрошення.
            </p>
          )}
        </div>

        {telegramFor && (
          <TelegramModal
            profile={telegramFor}
            onSave={(id, username) =>
              handleTelegramSave(telegramFor.id, id, username)
            }
            onClose={() => setTelegramFor(null)}
          />
        )}

        {metricAccessFor && (
          <MetricAccessModal
            profile={metricAccessFor}
            allMetrics={allMetrics}
            departments={departments}
            onSave={(metricIds) => handleMetricAccessSave(metricAccessFor.id, metricIds)}
            onClose={() => setMetricAccessFor(null)}
          />
        )}
      </div>

      <div>
        <h2 className="mb-4 text-base font-semibold text-ink">Запрошення</h2>
        <InvitationsSection invitations={invitations} departments={departments} />
      </div>
    </div>
  );
}
