import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("user_role", ["viewer", "editor", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "disabled"]);
export const professionEnum = pgEnum("profession", [
  "photographer",
  "videographer",
  "both",
]);
export const memberStatusEnum = pgEnum("member_status", [
  "active",
  "inactive",
  "suspended",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("viewer"),
    status: userStatusEnum("status").notNull().default("active"),
    mustChangePassword: boolean("must_change_password")
      .notNull()
      .default(false),
    tokenVersion: integer("token_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(sql`lower(${table.email})`),
  ],
);

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: text("member_id").notNull(),
    legacyId: text("legacy_id"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    /**
     * `phone` reduced to 10 digits (see `normalizePhone`). Onboarding
     * verification matches on this, so it must be an indexed equality check
     * rather than a per-row computation over every written variant in the
     * scanned ledger (`+91 98450 11234`, `098450-11234`, …).
     */
    normalizedPhone: text("normalized_phone"),
    profession: professionEnum("profession"),
    businessName: text("business_name"),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    area: text("area"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    pincode: char("pincode", { length: 6 }),
    dob: date("dob"),
    bloodGroup: text("blood_group"),
    status: memberStatusEnum("status").notNull().default("active"),
    feesPaidUpto: smallint("fees_paid_upto"),
    deathFundCovered: boolean("death_fund_covered").notNull().default(false),
    photoKey: text("photo_key"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("members_member_id_unique").on(table.memberId),
    uniqueIndex("members_legacy_id_active")
      .on(table.legacyId)
      .where(sql`${table.deletedAt} is null and ${table.legacyId} is not null`),
    uniqueIndex("members_email_active")
      .on(sql`lower(${table.email})`)
      .where(sql`${table.deletedAt} is null and ${table.email} is not null`),
    /**
     * Phone is deliberately NOT unique. A father and son running one studio,
     * or two members sharing a shop landline, is normal in this trade — the
     * old unique index made the second of them impossible to create, breaking
     * both the ledger import and member self-service. Duplicates surface as an
     * admin-visible warning via `checkDuplicates` instead of a hard constraint.
     */
    index("members_normalized_phone_idx")
      .on(table.normalizedPhone)
      .where(sql`${table.deletedAt} is null`),
    index("members_name_lower_idx").on(
      sql`lower(${table.firstName} || ' ' || ${table.lastName})`,
    ),
    index("members_status_idx").on(table.status),
    index("members_profession_idx").on(table.profession),
    index("members_fees_paid_upto_idx").on(table.feesPaidUpto),
    index("members_deleted_at_idx")
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} is null`),
    check(
      "members_pincode_format",
      sql`${table.pincode} is null or ${table.pincode} ~ '^[0-9]{6}$'`,
    ),
  ],
);

export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "approved",
  "rejected",
  "superseded",
]);

/**
 * A member's self-submitted details, awaiting review.
 *
 * Nothing here touches `members` until an admin approves it — that gap is the
 * load-bearing security control for a form gated only by facts a member knows
 * (see docs/specs/2026-07-27-member-self-service-onboarding.md §4).
 *
 * Submitted values are all nullable and unconstrained at the DB level:
 * validation belongs to `memberInputSchema` on the way in, and a half-complete
 * application should still be storable for an admin to look at.
 */
export const memberApplications = pgTable(
  "member_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Public reference, e.g. APP-7K4M2X. Never sequential — see spec §7.1. */
    applicationNo: text("application_no").notNull(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    status: applicationStatusEnum("status").notNull().default("pending"),

    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text("email"),
    phone: text("phone"),
    profession: professionEnum("profession"),
    businessName: text("business_name"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    area: text("area"),
    city: text("city"),
    state: text("state"),
    pincode: char("pincode", { length: 6 }),
    dob: date("dob"),
    bloodGroup: text("blood_group"),

    /** `pending/{id}.webp` in R2 until approval promotes it to the live key. */
    photoKey: text("photo_key"),

    rejectionReason: text("rejection_reason"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("member_applications_no_unique").on(table.applicationNo),
    index("member_applications_member_status_idx").on(
      table.memberId,
      table.status,
    ),
    index("member_applications_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
    /**
     * At most one live pending application per member. A resubmission must
     * supersede the previous one rather than queueing a second — otherwise an
     * admin reviews stale values, or the same member appears twice in the queue.
     */
    uniqueIndex("member_applications_one_pending")
      .on(table.memberId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

/**
 * Append-only log of onboarding verification attempts, mirroring
 * `loginAttempts` so the same sliding-window rate limiter applies. Keyed on
 * legacy (ledger) ID, which is what members actually type.
 */
export const applicationAttempts = pgTable(
  "application_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legacyId: text("legacy_id"),
    ip: text("ip"),
    success: boolean("success").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("application_attempts_legacy_created_idx").on(
      table.legacyId,
      table.createdAt,
    ),
    index("application_attempts_ip_created_idx").on(table.ip, table.createdAt),
  ],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    ip: text("ip"),
    success: boolean("success").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("login_attempts_email_created_idx").on(table.email, table.createdAt),
    index("login_attempts_ip_created_idx").on(table.ip, table.createdAt),
  ],
);
