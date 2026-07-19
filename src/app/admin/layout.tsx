import { redirect } from "next/navigation";
import { requireProfile, canManageAdmin } from "@/lib/auth";
import { TopNav } from "@/components/top-nav";
import Link from "next/link";

const ADMIN_LINKS = [
  { href: "/admin/employees", label: "Співробітники" },
  { href: "/admin/departments", label: "Відділи" },
  { href: "/admin/metrics", label: "Метрики" },
  { href: "/admin/invitations", label: "Запрошення" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, email } = await requireProfile();
  if (!canManageAdmin(profile.role)) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <TopNav email={email} role={profile.role} />
      <div className="flex flex-1">
        <aside className="hidden w-52 shrink-0 border-r border-border bg-surface sm:block">
          <nav className="flex flex-col gap-1 p-4">
            {ADMIN_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-page hover:text-ink transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
