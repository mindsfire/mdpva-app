ALTER TABLE "member_applications" ADD COLUMN "aadhaar_enc" text;--> statement-breakpoint
ALTER TABLE "member_applications" ADD COLUMN "aadhaar_hash" text;--> statement-breakpoint
ALTER TABLE "member_applications" ADD COLUMN "aadhaar_last4" char(4);--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "aadhaar_enc" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "aadhaar_hash" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "aadhaar_last4" char(4);--> statement-breakpoint
CREATE UNIQUE INDEX "members_aadhaar_hash_active" ON "members" USING btree ("aadhaar_hash") WHERE "members"."deleted_at" is null and "members"."aadhaar_hash" is not null;