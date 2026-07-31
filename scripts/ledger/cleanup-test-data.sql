-- Remove all pre-import test data, in FK-safe order.
--
-- Run once, before importing the legacy ledger CSV. Two groups are in scope:
--
--   * the 60 rows tagged by src/db/seed-ledger.ts. These MUST go before the
--     import: they hold legacy_id values 1, 2, 3, 4, 51 ... which collide with
--     real ledger numbers, and members_legacy_id_active is a unique index, so
--     the real members would be rejected at insert.
--   * 5 older untagged test members (phones 9100000000-9100000015). They carry
--     no seed tag, so `--clean` leaves them behind.
--
-- `seed-ledger.ts --clean` fails on its own because member_applications holds a
-- foreign key to members; the applications have to be deleted first.
--
-- These are hard deletes, not the app's usual soft delete: the rows are
-- fabricated, so there is nothing worth keeping recoverable.

BEGIN;

-- 1. Before: expect 65 members, 3 applications.
SELECT count(*) AS members_before FROM members WHERE deleted_at IS NULL;
SELECT count(*) AS applications_before FROM member_applications;

-- 2. Drop the applications blocking the member deletes. Scoped to test members
--    only; verified to be 3 rows, all approved, none belonging to anyone else.
DELETE FROM member_applications
WHERE member_id IN (
  SELECT id FROM members
  WHERE notes = '[seed-ledger] demo data — safe to delete'
     OR member_id IN (
       'MDPVA-2026-0001', 'MDPVA-2026-0004', 'MDPVA-2026-0006',
       'MDPVA-2026-0014', 'MDPVA-2026-0016'
     )
);

-- 3. The 60 tagged seed members.
DELETE FROM members
WHERE notes = '[seed-ledger] demo data — safe to delete';

-- 4. The 5 untagged test members, listed explicitly by member_id rather than
--    matched on a phone pattern, so this can never widen to a real record.
DELETE FROM members
WHERE member_id IN (
  'MDPVA-2026-0001', 'MDPVA-2026-0004', 'MDPVA-2026-0006',
  'MDPVA-2026-0014', 'MDPVA-2026-0016'
)
AND notes IS NULL
AND legacy_id IS NULL;      -- belt and braces: no real member reaches here

-- 5. After: both must be 0. If either is not, ROLLBACK instead of COMMIT.
SELECT count(*) AS members_after FROM members WHERE deleted_at IS NULL;
SELECT count(*) AS applications_after FROM member_applications;

COMMIT;

-- Optional, and safe to skip: clears rate-limit history accumulated during
-- testing. Not required for the import, but it stops a test-run lockout from
-- carrying into launch day. Both tables are throwaway by design.
-- DELETE FROM application_attempts;
-- DELETE FROM login_attempts;
