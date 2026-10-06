-- Additive only: who last corrected a pending application, and when.
-- Both NULL for every existing row; safe to apply before the code that uses it.
ALTER TABLE "member_applications" ADD COLUMN "edited_by" uuid;--> statement-breakpoint
ALTER TABLE "member_applications" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "member_applications" ADD CONSTRAINT "member_applications_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;