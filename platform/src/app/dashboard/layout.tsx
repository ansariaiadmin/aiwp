import { requireSession } from "@/lib/auth/rbac";
import { AppShell } from "@/components/shell/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <AppShell
      nav="customer"
      user={{ name: session.name, email: session.email, role: session.role }}
      title="داشبورد مشتری"
    >
      {children}
    </AppShell>
  );
}
