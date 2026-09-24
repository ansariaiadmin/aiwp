import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { roleAtLeast, type Role } from "@/lib/auth/rbac";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

type GuardResult = { ok: true; session: Session } | { ok: false; response: NextResponse };

async function requireApiRole(minimumRole: Role): Promise<GuardResult> {
  const session = await getCurrentSession();

  if (!session) {
    return { ok: false, response: NextResponse.json({ success: false, message: "احراز هویت لازم است." }, { status: 401 }) };
  }

  if (!roleAtLeast(session.role as Role, minimumRole)) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: "دسترسی غیرمجاز." }, { status: 403 }),
    };
  }

  return { ok: true, session };
}

export function requireApiAdmin() {
  return requireApiRole("ADMIN");
}

export function requireApiSuperAdmin() {
  return requireApiRole("SUPER_ADMIN");
}

export function requireApiAuth() {
  return requireApiRole("CUSTOMER");
}
