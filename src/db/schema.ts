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
    uniqueIndex("members_phone_active")
      .on(table.phone)
      .where(sql`${table.deletedAt} is null and ${table.phone} is not null`),
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
