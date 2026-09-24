/**
 * Append-only audit logging for every sensitive mutation (auth events,
 * license issuance/revocation, settings changes). Never edited or
 * deleted by application code.
 */
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export type AuditAction =
  | "auth.login.success"
  | "auth.login.failed"
  | "auth.login.locked"
  | "auth.logout"
  | "auth.register"
  | "auth.password.reset_requested"
  | "auth.password.reset_completed"
  | "auth.password.changed"
  | "auth.2fa.enabled"
  | "auth.2fa.disabled"
  | "user.role.changed"
  | "user.status.changed"
  | "user.created"
  | "user.deleted"
  | "product.created"
  | "product.updated"
  | "product.deleted"
  | "product.release.created"
  | "license.created"
  | "license.revoked"
  | "license.suspended"
  | "license.activated"
  | "license.deactivated"
  | "order.created"
  | "order.paid"
  | "order.failed"
  | "settings.ai_provider.updated"
  | "settings.sms_gateway.updated"
  | "settings.payment.updated"
  | "settings.general.updated"
  | "api_key.created"
  | "api_key.revoked"
  | "kb.document.ingested"
  | "kb.document.deleted";

export async function recordAuditLog(entry: {
  actorId?: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await db.insert(auditLogs).values({
    actorId: entry.actorId ?? null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: entry.metadata,
    ip: entry.ip ?? null,
    userAgent: entry.userAgent ?? null,
  });
}
