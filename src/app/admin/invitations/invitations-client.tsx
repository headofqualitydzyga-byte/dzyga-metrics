"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Invitation, UserRole } from "@/types/database";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Адмін",
  manager: "Керівник",
  viewer: "CEO / Спостерігач",
};

type InvitationWithDept = Invitation & {
  departments: { name: string } | null;
};

export default function InvitationsClient({
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

  const appUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="flex flex-col gap-6">
      {/* Send invite form */}
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

      {/* Invitations table */}
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
