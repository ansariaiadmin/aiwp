/**
 * AiWp Platform — database schema (Drizzle ORM / PostgreSQL).
 *
 * Pure TypeScript, no native binaries required (unlike Prisma's Rust
 * query engine) — this keeps local dev, CI, and the production Docker
 * image simple and fast to build.
 */
import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  bigint,
  uniqueIndex,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => createId());

/**
 * pgvector's `vector(n)` column type.
 *
 * Drizzle has no built-in for it. Values cross the wire as pgvector's own
 * text form ("[0.1,0.2,0.3]"), which is what the driver returns for a
 * vector column, so no binary parser is needed — hence mapFromDriverValue
 * is the identity and the JS side stays a plain number[].
 */
export const EMBEDDING_DIMENSIONS = 1536;

const vectorType = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? EMBEDDING_DIMENSIONS})`;
  },
  fromDriver(value) {
    return typeof value === "string" ? JSON.parse(value) : value;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
});

export const vector = vectorType;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", ["SUPER_ADMIN", "ADMIN", "CUSTOMER"]);
export const userStatusEnum = pgEnum("user_status", [
  "ACTIVE",
  "SUSPENDED",
  "PENDING_VERIFICATION",
]);
export const licenseStatusEnum = pgEnum("license_status", [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "EXPIRED",
]);
export const settingCategoryEnum = pgEnum("setting_category", [
  "AI_PROVIDER",
  "SMS_GATEWAY",
  "GENERAL",
  "EMAIL",
  "PAYMENT",
]);

// ---------------------------------------------------------------------------
// Identity & access control
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    emailVerifiedAt: timestamp("email_verified_at"),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: roleEnum("role").notNull().default("CUSTOMER"),
    status: userStatusEnum("status").notNull().default("PENDING_VERIFICATION"),
    twoFactorSecret: text("two_factor_secret"),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until"),
    lastLoginAt: timestamp("last_login_at"),
    lastLoginIp: text("last_login_ip"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_role_idx").on(table.role),
    index("users_status_idx").on(table.status),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("password_reset_token_hash_idx").on(table.tokenHash),
    index("password_reset_user_id_idx").on(table.userId),
  ],
);

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_verification_token_hash_idx").on(table.tokenHash),
    index("email_verification_user_id_idx").on(table.userId),
  ],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("api_keys_key_hash_idx").on(table.keyHash),
    index("api_keys_user_id_idx").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// Products / licensing — mirrors modules/license-client's HTTP contract
// ---------------------------------------------------------------------------

export const products = pgTable(
  "products",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    currentVersion: text("current_version").notNull().default("1.0.0"),
    changelog: text("changelog"),
    packageUrl: text("package_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("products_slug_idx").on(table.slug)],
);

export const productReleases = pgTable(
  "product_releases",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    changelog: text("changelog"),
    packageUrl: text("package_url").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_releases_unique_idx").on(table.productId, table.version),
  ],
);

export const licenses = pgTable(
  "licenses",
  {
    id: id(),
    key: text("key").notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    status: licenseStatusEnum("status").notNull().default("INACTIVE"),
    maxActivations: integer("max_activations").notNull().default(1),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("licenses_key_idx").on(table.key),
    index("licenses_user_id_idx").on(table.userId),
    index("licenses_product_id_idx").on(table.productId),
  ],
);

export const licenseActivations = pgTable(
  "license_activations",
  {
    id: id(),
    licenseId: text("license_id")
      .notNull()
      .references(() => licenses.id, { onDelete: "cascade" }),
    siteUrl: text("site_url").notNull(),
    ip: text("ip"),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    activatedAt: timestamp("activated_at").notNull().defaultNow(),
    deactivatedAt: timestamp("deactivated_at"),
  },
  (table) => [
    uniqueIndex("license_activations_unique_idx").on(table.licenseId, table.siteUrl),
  ],
);

// ---------------------------------------------------------------------------
// Platform settings — AI provider + SMS gateway credentials, encrypted at
// rest (AES-256-GCM, see src/lib/crypto.ts). Never stored in plaintext.
// ---------------------------------------------------------------------------

export const platformSettings = pgTable(
  "platform_settings",
  {
    id: id(),
    category: settingCategoryEnum("category").notNull(),
    key: text("key").notNull(),
    valueEncrypted: text("value_encrypted").notNull(),
    isSecret: boolean("is_secret").notNull().default(true),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    updatedById: text("updated_by_id"),
  },
  (table) => [
    uniqueIndex("platform_settings_unique_idx").on(table.category, table.key),
  ],
);

// ---------------------------------------------------------------------------
// Audit log — append-only, every sensitive mutation
// ---------------------------------------------------------------------------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_actor_id_idx").on(table.actorId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Commerce — plans, orders and payments.
//
// This is the layer that turns an issued license into a sale: a visitor
// picks a plan, an order is created, the gateway redirects them away, and
// the *verified* gateway callback is what provisions the license. Nothing
// in the storefront grants a license directly — see src/lib/commerce.ts.
// ---------------------------------------------------------------------------

export const orderStatusEnum = pgEnum("order_status", [
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELED",
  "REFUNDED",
]);

export const paymentGatewayEnum = pgEnum("payment_gateway", [
  "mock",
  "zarinpal",
  "stripe",
]);

/**
 * A sellable tier of a product (Regular / Developer / Agency, ...).
 * `price` is always in the currency's smallest unit so no float rounding
 * ever touches money: IRR has no subunit in practice, so 1_500_000 means
 * 1,500,000 IRR (= 15,000 Toman); for USD, 4900 means $49.00.
 */
export const productPlans = pgTable(
  "product_plans",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    price: bigint("price", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("IRR"),
    maxActivations: integer("max_activations").notNull().default(1),
    /** null = lifetime (no expiry). */
    durationDays: integer("duration_days"),
    supportDays: integer("support_days").notNull().default(180),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("product_plans_unique_idx").on(table.productId, table.slug),
    index("product_plans_product_id_idx").on(table.productId),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: id(),
    /** Human-friendly order number shown to the buyer and in support mails. */
    reference: text("reference").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    planId: text("plan_id")
      .notNull()
      .references(() => productPlans.id),
    // Snapshots, not foreign keys alone: the price and the names a buyer
    // agreed to must never silently change under a past order.
    productName: text("product_name").notNull(),
    planName: text("plan_name").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("IRR"),
    // Terms the buyer actually agreed to, snapshotted at order time: an
    // admin editing the plan afterwards must never change what an already
    // placed order entitles its buyer to.
    maxActivations: integer("max_activations").notNull().default(1),
    durationDays: integer("duration_days"),
    status: orderStatusEnum("status").notNull().default("PENDING"),
    gateway: paymentGatewayEnum("gateway").notNull(),
    /** Gateway-side identifier (ZarinPal authority, Stripe session id, ...). */
    gatewayRefId: text("gateway_ref_id"),
    gatewayMeta: jsonb("gateway_meta"),
    /** Set once, by the verified callback that provisioned the license. */
    licenseId: text("license_id").references(() => licenses.id, {
      onDelete: "set null",
    }),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("orders_reference_idx").on(table.reference),
    index("orders_user_id_idx").on(table.userId),
    index("orders_status_idx").on(table.status),
    index("orders_product_id_idx").on(table.productId),
    // A gateway reference may only ever satisfy one order. NULLs are
    // distinct in Postgres, so unpaid orders (no ref yet) are unaffected.
    uniqueIndex("orders_gateway_ref_idx").on(table.gatewayRefId),
  ],
);

// ---------------------------------------------------------------------------
// Relations (for ergonomic query().with() usage)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Knowledge base (RAG)
// ---------------------------------------------------------------------------
//
// Three tables, deliberately separate:
//
//   kb_documents — one row per ingested source (a doc page, a support
//                  article, a marketplace FAQ). Carries the provenance an
//                  operator needs to audit an answer.
//   kb_chunks    — the document split into retrieval units, each with its
//                  embedding. This is the only table a search touches.
//   kb_sources   — a small enum-ish registry so the crawler, the manual
//                  uploader and the marketplace scraper cannot collide on
//                  the same document key.
//
// Chunking happens at ingest time, not query time, so retrieval cost is
// bounded by the number of chunks rather than by document length.

export const kbSourceKindEnum = pgEnum("kb_source_kind", [
  "DOCS",
  "SUPPORT",
  "MARKETPLACE",
  "CHANGELOG",
  "CODE",
  "MANUAL",
]);

export const kbDocuments = pgTable(
  "kb_documents",
  {
    id: id(),
    sourceKind: kbSourceKindEnum("source_kind").notNull(),
    /** Stable identity of the source, e.g. a URL or a file path. */
    sourceKey: text("source_key").notNull(),
    title: text("title").notNull(),
    /** Raw text as ingested, kept so re-chunking never needs a re-fetch. */
    body: text("body").notNull(),
    url: text("url"),
    /** Set when the model that embedded this is swapped; forces re-embedding. */
    embeddingModel: text("embedding_model"),
    /** Hash of the normalised body; unchanged hash skips re-embedding. */
    contentHash: text("content_hash"),
    /** The model that produced the current vectors. */
    indexedEmbeddingModel: text("indexed_embedding_model"),
    chunkCount: integer("chunk_count").notNull().default(0),
    lastIngestedAt: timestamp("last_ingested_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("kb_documents_source_idx").on(table.sourceKind, table.sourceKey),
    index("kb_documents_ingested_idx").on(table.lastIngestedAt),
  ],
);

export const kbChunks = pgTable(
  "kb_chunks",
  {
    id: id(),
    documentId: text("document_id")
      .notNull()
      .references(() => kbDocuments.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    content: text("content").notNull(),
    /**
     * Normalised copy used for retrieval (tsvector + embedding input).
     * Kept separate from content so regional letter variants, half-space and
     * digit forms all match, while content stays verbatim for display.
     */
    searchText: text("search_text"),
    /**
     * Null while a document awaits embedding. Retrieval filters these out,
     * so a partially-ingested corpus degrades instead of returning text
     * that was never ranked.
     */
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    tokenEstimate: integer("token_estimate").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("kb_chunks_document_ordinal_idx").on(table.documentId, table.ordinal),
  ],
);

export const agentEvents = pgTable(
  "agent_events",
  {
    id: id(),
    /** Which quality rule the event concerns. */
    ruleId: text("rule_id").notNull(),
    severity: text("severity").notNull(),
    /** "violation" when the scan caught a breach, "fix" when a lesson was recorded. */
    kind: text("kind").notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("agent_events_rule_idx").on(table.ruleId),
    index("agent_events_created_idx").on(table.createdAt),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  licenses: many(licenses),
  auditLogs: many(auditLogs),
  apiKeys: many(apiKeys),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const licensesRelations = relations(licenses, ({ one, many }) => ({
  product: one(products, { fields: [licenses.productId], references: [products.id] }),
  user: one(users, { fields: [licenses.userId], references: [users.id] }),
  activations: many(licenseActivations),
}));

export const licenseActivationsRelations = relations(licenseActivations, ({ one }) => ({
  license: one(licenses, {
    fields: [licenseActivations.licenseId],
    references: [licenses.id],
  }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  licenses: many(licenses),
  releases: many(productReleases),
}));

export const kbDocumentsRelations = relations(kbDocuments, ({ many }) => ({
  chunks: many(kbChunks),
}));

export const kbChunksRelations = relations(kbChunks, ({ one }) => ({
  document: one(kbDocuments, {
    fields: [kbChunks.documentId],
    references: [kbDocuments.id],
  }),
}));

export const productReleasesRelations = relations(productReleases, ({ one }) => ({
  product: one(products, {
    fields: [productReleases.productId],
    references: [products.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}));

export const productPlansRelations = relations(productPlans, ({ one }) => ({
  product: one(products, {
    fields: [productPlans.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  product: one(products, { fields: [orders.productId], references: [products.id] }),
  plan: one(productPlans, { fields: [orders.planId], references: [productPlans.id] }),
  license: one(licenses, { fields: [orders.licenseId], references: [licenses.id] }),
}));

export const sqlNow = sql`now()`;
