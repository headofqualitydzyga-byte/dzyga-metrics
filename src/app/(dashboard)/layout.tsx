import { requireProfile } from "@/lib/auth";
import { TopNav } from "@/components/top-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, email } = await requireProfile();

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <TopNav email={email} role={profile.role} />
      <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
