import { requireAdmin } from "@/lib/auth/rbac";
import { AppShell } from "@/components/shell/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <AppShell
      nav="admin"
      user={{ name: session.name, email: session.email, role: session.role }}
      title="پنل مدیریت"
    >
      {children}
    </AppShell>
  );
}
