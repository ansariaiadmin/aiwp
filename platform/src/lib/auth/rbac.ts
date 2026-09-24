/**
 * Role-based access control helpers. Used both by middleware.ts (route
 * gating, cheap JWT-only check) and by Server Components/API routes
 * (full check including the server-side session record).
 */
import { getCurrentSession } from "./session";
import { redirect } from "next/navigation";

export type Role = "SUPER_ADMIN" | "ADMIN" | "CUSTOMER";

const ROLE_RANK: Record<Role, number> = {
  CUSTOMER: 0,
  ADMIN: 1,
  SUPER_ADMIN: 2,
};

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/**
 * For use at the top of a Server Component/Route Handler: returns the
 * current session or redirects to /login. Optionally enforces a minimum
 * role, redirecting to a "not authorized" page otherwise.
 */
export async function requireSession(minimumRole?: Role) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (minimumRole && !roleAtLeast(session.role as Role, minimumRole)) {
    redirect("/403");
  }

  return session;
}

export async function requireAdmin() {
  return requireSession("ADMIN");
}

export async function requireSuperAdmin() {
  return requireSession("SUPER_ADMIN");
}
