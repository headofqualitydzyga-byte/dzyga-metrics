"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcceptInviteForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Пароль має бути мінімум 8 символів");
      return;
    }
    if (password !== confirm) {
      setError("Паролі не співпадають");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Помилка");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">
          Email
        </label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-muted"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">
          Новий пароль
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          placeholder="Мінімум 8 символів"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">
          Підтвердити пароль
        </label>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          placeholder="Повторіть пароль"
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
      >
        {loading ? "Обробляємо..." : "Прийняти запрошення"}
      </button>
    </form>
  );
}
