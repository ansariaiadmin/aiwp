import { db } from "@/lib/db";
import { users, licenses, products, auditLogs } from "@/lib/db/schema";
import { count, eq, gte, sql, desc } from "drizzle-orm";

export async function getAdminDashboardStats() {
  const [[userCount], [customerCount], [activeLicenseCount], [productCount], [recentSignups]] =
    await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(users).where(eq(users.role, "CUSTOMER")),
      db.select({ value: count() }).from(licenses).where(eq(licenses.status, "ACTIVE")),
      db.select({ value: count() }).from(products),
      db
        .select({ value: count() })
        .from(users)
        .where(gte(users.createdAt, sql`now() - interval '30 days'`)),
    ]);

  return {
    totalUsers: userCount?.value ?? 0,
    totalCustomers: customerCount?.value ?? 0,
    activeLicenses: activeLicenseCount?.value ?? 0,
    totalProducts: productCount?.value ?? 0,
    newSignupsLast30Days: recentSignups?.value ?? 0,
  };
}

/**
 * Uses a plain LEFT JOIN (not Drizzle's relational query API, which
 * compiles `with: {...}` into a LATERAL join) both for portability across
 * every Postgres-compatible engine and because a single flat join is
 * cheaper than a per-row correlated subquery for a simple one-to-one
 * relation like this.
 */
export async function getRecentAuditLogs(limit = 10) {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      ip: auditLogs.ip,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    ip: row.ip,
    createdAt: row.createdAt,
    actor: row.actorName ? { name: row.actorName, email: row.actorEmail! } : null,
  }));
}

/**
 * Zero-filled daily signup counts for the last `days` days (inclusive of
 * today). Uses generate_series to LEFT JOIN against so days with no
 * signups still appear as { count: 0 } instead of being silently
 * skipped — otherwise a trend chart plotted straight from a GROUP BY
 * would show misleading gaps/jumps on quiet days.
 */
export async function getSignupSeries(days = 14) {
  const rows = await db.execute(sql`
    select
      d.day::date as day,
      count(${users.id})::int as count
    from generate_series(
      date_trunc('day', now()) - (${days - 1} || ' days')::interval,
      date_trunc('day', now()),
      interval '1 day'
    ) as d(day)
    left join ${users}
      on date_trunc('day', ${users.createdAt}) = d.day
    group by d.day
    order by d.day asc
  `);

  return rows as unknown as { day: string; count: number }[];
}
