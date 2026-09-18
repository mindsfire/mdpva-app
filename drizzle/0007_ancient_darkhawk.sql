ALTER TYPE "public"."profession" ADD VALUE 'other';--> statement-breakpoint
ALTER TABLE "member_applications" ADD COLUMN "profession_other" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "profession_other" text;