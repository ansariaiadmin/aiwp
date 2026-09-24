import { requireApiAuth } from "@/lib/api-guard";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { jsonOk } from "@/lib/http";

export async function GET() {
  const guard = await requireApiAuth();
  if (!guard.ok) return guard.response;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      twoFactorEnabled: users.twoFactorEnabled,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(eq(users.id, guard.session.userId))
    .limit(1);

  return jsonOk({ user: rows[0] });
}
