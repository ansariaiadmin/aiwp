/**
 * Session management: short-lived signed JWT stored in an httpOnly cookie,
 * backed by a server-side session record (so sessions are revocable —
 * pure stateless JWTs can't be invalidated before expiry). This gives us
 * both the performance of JWT verification (no DB hit on every request in
 * middleware) and the security of server-side revocation for anything
 * that actually mutates data.
 */
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import { verifySessionTokenEdge, SESSION_COOKIE, type SessionPayload } from "./session-edge";

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getJwtSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short (needs 32+ chars). Set it in your environment.",
    );
  }

  return new TextEncoder().encode(secret);
}

export type { SessionPayload };

export async function createSession(
  userId: string,
  role: SessionPayload["role"],
  meta: { ip?: string; userAgent?: string },
): Promise<string> {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash,
      ip: meta.ip,
      userAgent: meta.userAgent,
      expiresAt,
    })
    .returning({ id: sessions.id });

  const jwt = await new SignJWT({ sid: session.id, uid: userId, role } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getJwtSecret());

  return jwt;
}

export const verifySessionToken = verifySessionTokenEdge;

/**
 * Full session validation used by Server Components / API routes: verifies
 * the JWT signature AND that the underlying session row is still valid
 * (not revoked, not expired, user still active) — this is what makes
 * sessions truly revocable server-side.
 */
export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, payload.sid),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row || row.status !== "ACTIVE") return null;

  return row;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return;

  const payload = await verifySessionToken(token);
  if (payload) {
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, payload.sid));
  }

  await clearSessionCookie();
}

export async function revokeAllSessionsForUser(userId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export { SESSION_COOKIE };
