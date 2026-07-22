import { redirect } from "next/navigation";
import { requireProfile, canManageMetrics } from "@/lib/auth";
import { TopNav } from "@/components/top-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, email } = await requireProfile();
  // Broadest gate for the /admin/* tree: admin or viewer (CEO). Pages that
  // are admin-only (employees, departments) enforce that themselves below.
  if (!canManageMetrics(profile.role)) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <TopNav email={email} role={profile.role} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
