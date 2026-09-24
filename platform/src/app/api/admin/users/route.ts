import { requireApiAdmin } from "@/lib/api-guard";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { jsonOk } from "@/lib/http";

export async function GET() {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      twoFactorEnabled: users.twoFactorEnabled,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return jsonOk({ users: rows });
}
