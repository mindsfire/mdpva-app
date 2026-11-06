CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"business_name" text,
	"amount" integer NOT NULL,
	"photo_key" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donations_amount_positive" CHECK ("donations"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donations_created_at_idx" ON "donations" USING btree ("created_at");