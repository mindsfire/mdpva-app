DROP INDEX "members_name_lower_idx";--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "last_name" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "members_name_lower_idx" ON "members" USING btree (lower(trim("first_name" || ' ' || coalesce("last_name", ''))));