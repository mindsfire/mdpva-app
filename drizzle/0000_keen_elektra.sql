CREATE TYPE "public"."member_status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."profession" AS ENUM('photographer', 'videographer', 'both');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('viewer', 'editor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"ip" text,
	"success" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" text NOT NULL,
	"legacy_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"profession" "profession",
	"business_name" text,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"area" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" char(6),
	"dob" date,
	"blood_group" text,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"fees_paid_upto" smallint,
	"death_fund_covered" boolean DEFAULT false NOT NULL,
	"photo_key" text,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "members_pincode_format" CHECK ("members"."pincode" is null or "members"."pincode" ~ '^[0-9]{6}$')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"token_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_attempts_email_created_idx" ON "login_attempts" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "login_attempts_ip_created_idx" ON "login_attempts" USING btree ("ip","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "members_member_id_unique" ON "members" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_legacy_id_active" ON "members" USING btree ("legacy_id") WHERE "members"."deleted_at" is null and "members"."legacy_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "members_email_active" ON "members" USING btree (lower("email")) WHERE "members"."deleted_at" is null and "members"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "members_phone_active" ON "members" USING btree ("phone") WHERE "members"."deleted_at" is null and "members"."phone" is not null;--> statement-breakpoint
CREATE INDEX "members_name_lower_idx" ON "members" USING btree (lower("first_name" || ' ' || "last_name"));--> statement-breakpoint
CREATE INDEX "members_status_idx" ON "members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "members_profession_idx" ON "members" USING btree ("profession");--> statement-breakpoint
CREATE INDEX "members_fees_paid_upto_idx" ON "members" USING btree ("fees_paid_upto");--> statement-breakpoint
CREATE INDEX "members_deleted_at_idx" ON "members" USING btree ("deleted_at") WHERE "members"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));