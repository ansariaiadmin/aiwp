/**
 * Edge-safe subset of session verification: JWT signature check only, no
 * database access. Used exclusively by middleware.ts, which runs on the
 * Edge Runtime where Node built-ins (node:crypto, database drivers) are
 * unavailable. Full validation (including server-side revocation lookup)
 * still happens in lib/auth/session.ts for Server Components/Route
 * Handlers running on the Node.js runtime.
 */
import { jwtVerify } from "jose";

export const SESSION_COOKIE = "aiwp_session";

export interface SessionPayload {
  sid: string;
  uid: string;
  role: "SUPER_ADMIN" | "ADMIN" | "CUSTOMER";
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is missing or too short (needs 32+ chars).");
  }

  return new TextEncoder().encode(secret);
}

export async function verifySessionTokenEdge(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    if (
      typeof payload.sid !== "string" ||
      typeof payload.uid !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }

    return { sid: payload.sid, uid: payload.uid, role: payload.role as SessionPayload["role"] };
  } catch {
    return null;
  }
}
