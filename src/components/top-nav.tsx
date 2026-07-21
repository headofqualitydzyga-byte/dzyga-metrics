"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ROLE_LABELS } from "@/lib/roles";
import type { UserRole } from "@/types/database";

interface NavLink {
  href: string;
  label: string;
}

const ADMIN_LINKS: NavLink[] = [
  { href: "/admin/employees", label: "Співробітники" },
  { href: "/admin/departments", label: "Відділи" },
  { href: "/admin/metrics", label: "Метрики" },
];

function getLinks(role: UserRole): NavLink[] {
  const links: NavLink[] = [{ href: "/dashboard", label: "Дашборд" }];
  if (role === "admin") links.push(...ADMIN_LINKS);
  return links;
}

export function TopNav({
  email,
  role,
}: {
  email: string;
  role: UserRole;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const links = getLinks(role);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="relative border-b border-border bg-surface px-4 sm:px-6">
      <div className="flex h-16 items-center justify-between">
        <Link href="/" className="text-base font-semibold tracking-tight text-ink">
          Dzyga <span className="text-accent">Metrics</span>
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-muted hover:text-ink transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <span className="text-sm text-muted">{email}</span>
          <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
            {ROLE_LABELS[role]}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm text-muted underline hover:text-ink"
          >
            Вийти
          </button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Меню"
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ink sm:hidden"
        >
          {open ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-16 z-50 flex flex-col gap-1 border-b border-border bg-surface px-4 py-3 shadow-lg sm:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-ink hover:bg-page"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted">{email}</span>
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
              {ROLE_LABELS[role]}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-muted underline"
          >
            Вийти
          </button>
        </div>
      )}
    </header>
  );
}
