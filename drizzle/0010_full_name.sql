-- Single full name: fold last_name into first_name for members and
-- member_applications. The last_name column is intentionally KEPT (all NULL)
-- for one release so this is reversible; drop it in a follow-up.
--
-- Rollback note: the split is not recoverable from data alone. Take a
-- snapshot/backup before applying if the original split must be restorable.
UPDATE "members"
SET "first_name" = trim("first_name" || ' ' || coalesce("last_name", '')),
    "last_name" = NULL
WHERE "last_name" IS NOT NULL;--> statement-breakpoint
UPDATE "member_applications"
SET "first_name" = nullif(trim(coalesce("first_name", '') || ' ' || coalesce("last_name", '')), ''),
    "last_name" = NULL
WHERE "last_name" IS NOT NULL;
