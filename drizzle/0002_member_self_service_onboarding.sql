CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'rejected', 'superseded');--> statement-breakpoint
CREATE TABLE "application_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"ip" text,
	"success" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_no" text NOT NULL,
	"member_id" uuid NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text,
	"phone" text,
	"profession" "profession",
	"business_name" text,
	"address_line1" text,
	"address_line2" text,
	"area" text,
	"city" text,
	"state" text,
	"pincode" char(6),
	"dob" date,
	"blood_group" text,
	"photo_key" text,
	"rejection_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "members_phone_active";--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "normalized_phone" text;--> statement-breakpoint
ALTER TABLE "member_applications" ADD CONSTRAINT "member_applications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_applications" ADD CONSTRAINT "member_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_attempts_legacy_created_idx" ON "application_attempts" USING btree ("legacy_id","created_at");--> statement-breakpoint
CREATE INDEX "application_attempts_ip_created_idx" ON "application_attempts" USING btree ("ip","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "member_applications_no_unique" ON "member_applications" USING btree ("application_no");--> statement-breakpoint
CREATE INDEX "member_applications_member_status_idx" ON "member_applications" USING btree ("member_id","status");--> statement-breakpoint
CREATE INDEX "member_applications_status_created_idx" ON "member_applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "member_applications_one_pending" ON "member_applications" USING btree ("member_id") WHERE "member_applications"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "members_normalized_phone_idx" ON "members" USING btree ("normalized_phone") WHERE "members"."deleted_at" is null;