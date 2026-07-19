"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/types/database";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Адмін",
  manager: "Керівник",
  viewer: "CEO / Спостерігач",
};

type ProfileWithDept = Profile & { departments: { name: string } | null };

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

export default function EmployeesClient({
  profiles: initial,
  departments,
}: {
  profiles: ProfileWithDept[];
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [profiles, setProfiles] = useState(initial);
  const [telegramFor, setTelegramFor] = useState<ProfileWithDept | null>(null);

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

  return (
    <>
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
                  <button
                    type="button"
                    onClick={() => setTelegramFor(p)}
                    className="text-sm text-accent hover:underline"
                  >
                    Telegram
                  </button>
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
    </>
  );
}
