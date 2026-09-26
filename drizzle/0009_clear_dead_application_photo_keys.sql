-- Data-only backfill (no schema change).
-- Applications that have left "pending" had their pending R2 photo deleted
-- (promoted to the member's live key on approve, discarded on reject or
-- supersede), but older rows still point at the deleted `app/pending/...`
-- object and render as broken images. Clear those dead references; the app
-- now shows the member's live photo for approved rows and a "discarded"
-- placeholder for rejected ones. Matches `isPendingPhotoKey` in src/lib/r2.ts.
UPDATE "member_applications"
SET "photo_key" = NULL
WHERE "status" <> 'pending'
  AND "photo_key" LIKE 'app/pending/%';
