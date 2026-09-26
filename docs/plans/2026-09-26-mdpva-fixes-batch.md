# MDPVA fixes & features, 2026-09-26

> On approval, save this file as `docs/plans/2026-09-26-mdpva-fixes-batch.md` (matches the existing `docs/plans/` naming).

## Context
There are nine items from admin and member feedback. I've grouped them into **5 independent workstreams (A–E)** so that separate agents can run in parallel without editing the same files. Each agent works on its own branch or worktree off `main` and opens its own PR. Per AGENTS.md, read `node_modules/next/dist/docs/` before touching any Next APIs.

**Merge order:** C → A → B/D/E. B and C both edit `src/lib/pdf/application-pdf.tsx`, so B rebases after C.

---

## Workstream A: Application photos broken for Approved/Rejected (item 7)
**Root cause (confirmed in code):** `src/app/actions/applications.ts`
- On approve (~L112–123), the pending photo `app/pending/<id>.webp` is copied to the live key `photoKeyFor(memberId)` and then **deleted**.
- On reject (~L209–212), the pending photo is also **deleted**.
- In both cases `member_applications.photo_key` still points at the deleted object, so `/api/photos/...` returns 404 and the page shows a broken image.
- Affected render sites: `src/components/applications/queue-table.tsx:166-169` and `src/app/(app)/applications/[id]/page.tsx:104-107`.

**Fix:**
1. Approved rows: show the member's live photo instead, `photoUrl(member.photoKey, member.updatedAt)`. Add `memberPhotoKey` to the queue query in `applications.ts` (~L313–362).
2. Rejected rows: stop showing a dead link. Choose one:
   - (a) Recommended: null out `photo_key` when rejecting and render a "Photo discarded on rejection" placeholder.
   - (b) Keep the pending object until resubmit.

   Go with (a) unless the admin needs to see what was rejected.
3. Backfill: a one-off SQL in `drizzle/` that sets `photo_key = null` for applications whose status is not pending and whose key starts with `app/pending/` (use `isPendingPhotoKey` in `src/lib/r2.ts`).
4. Add tests next to the existing `applications` and `photo-url` tests.

## Workstream B: Submission dates in IST (item 1)
**Problem:** `dateFmt` is `new Intl.DateTimeFormat("en-IN", {day, month, year})` with **no `timeZone`**, and it's duplicated in these files:
- `queue-table.tsx:34`
- `applications/[id]/page.tsx:14`
- `onboard/application-status.tsx:12`
- `lib/pdf/application-pdf.tsx`

Server components render in the server's time zone (UTC on Vercel). Submissions between 00:00 and 05:30 IST therefore show the previous day, and no time is shown at all.

**Fix:**
1. Add `src/lib/format-date.ts` with `formatDateIST` and `formatDateTimeIST`, both using `timeZone: "Asia/Kolkata"`. Example output: `26 Sept 2026, 3:42 pm IST`.
2. Replace every local `dateFmt` with these helpers:
   - Show date and time for Submitted and Reviewed in the queue (all tabs: pending, approved, rejected), on the detail page, and on the member status screen.
   - Keep date-only in the PDF.
3. Unit test: `2026-09-25T20:00:00Z` should render as 26 Sept, 1:30 am IST.
4. Check that `created_at` is `timestamptz` in `src/db/schema.ts`. If it isn't, flag it in the PR.

## Workstream C: Download form (PDF) cleanup (items 3, 4, 5, 6)
Everything is in `src/lib/pdf/application-pdf.tsx`, in `buildApplicationPdfSections` and the template, plus `application-pdf.test.ts`.
- **3. Remove MDPVA ID:** delete the `{ label: "Member ID", value: member.memberId }` row. Also check the header and letterhead for `memberId` and remove it there too. The legacy "Membership no." stays as the primary ID.
- **4. Kannada labels missing:** the Status, Fees, Death fund and Notes rows have no `labelKn`. The code comment says "never invents Kannada copy".
  - Add reviewed strings to `src/lib/onboarding/i18n.ts` (`status`, `deathFund`, `remarks`, and section titles such as Identity, Contact, Association, Membership) and wire in `labelKn`/`titleKn`.
  - Proposed Kannada (**needs confirmation from the office**):
    - Status: ಸ್ಥಿತಿ
    - Death fund: ಮರಣ ನಿಧಿ
    - Remarks: ಷರಾ
    - Covered / Not covered: ಒಳಗೊಂಡಿದೆ / ಒಳಗೊಂಡಿಲ್ಲ
    - Identity: ಗುರುತು
    - Contact: ಸಂಪರ್ಕ
    - Membership: ಸದಸ್ಯತ್ವ
  - Audit every field so each one renders a Kannada label. Check existing keys in `STRINGS` first.
- **5. Remove "Fees paid upto" from the PDF only.** The drawer, form and CSV stay as they are.
- **6. "Notes" becomes "Remarks" in the PDF only**, for both the section title and the label. The drawer (`member-sections.ts`) is unchanged.
- Update the tests: the expected labels list, and the single-page A4 test, which still has to pass.

## Workstream D: Remove Last name and use a single Full Name (item 2)
**Feasible.** `last_name` is already nullable, and `fullName()` in `src/lib/member-name.ts` already joins the two names.

**Recommended approach:** keep the DB column for one release so the change is reversible, but stop reading and writing it anywhere in the UI.
1. **Migration:**
   - `drizzle/0009_full_name.sql`: `UPDATE members SET first_name = trim(first_name || ' ' || coalesce(last_name,'')), last_name = NULL`. Do the same for `member_applications`.
   - Rename the column label in the UI to "Full name" (`S.firstName` becomes `S.fullName`, ಪೂರ್ಣ ಹೆಸರು).
   - Renaming the column to `full_name` can be a follow-up.
2. **Onboard form:** remove the Last name field from `src/components/onboard/onboard-form.tsx` (~L51, 96, 588-597), `application-sheet.tsx:123`, `src/app/onboard/form/page.tsx`, `actions/onboard-submit.ts` and `validation/application.ts`.
3. **Admin member form:** remove it from `member-form.tsx:205` and `validation/member.ts`.
4. **Display sites:** `fullName(first, last)` is used in the dashboard, table, card, profile, drawer, breadcrumbs and the duplicate-number message. Change it to `fullName(first)` for now, or simplify it to `member.firstName`. `member-badges.tsx` `initials()` should take initials from the words in the full name.
5. **Other places:**
   - PDF: one "Full name" row. **Coordinate with Workstream C** by rebasing after C.
   - CSV import/export: `src/lib/csv/member-csv.ts`. Drop `last_name` from export and the template; on import, concatenate it if it's present, for backward compatibility.
   - `diff.ts` in onboarding, `members-query.ts` search and sort, and `scripts/ledger/import-members.ts`.
6. Update every affected test (`grep -rn lastName src`).

## Workstream E: Onboarding copy and UX (items 8, 9)
**8. Approved status statement.** Change `statusApprovedBody` in `src/lib/onboarding/i18n.ts:166` so the message says the office will reach out, not that the member should call. Proposed text (**office to confirm the Kannada**):
- EN: "Your details are now in the member directory. If anything needs to change, the MDPVA office will contact you. This page can no longer be used to submit changes."
- KN: "ನಿಮ್ಮ ವಿವರಗಳು ಈಗ ಸದಸ್ಯರ ಪಟ್ಟಿಯಲ್ಲಿವೆ. ಏನಾದರೂ ಬದಲಾವಣೆ ಅಗತ್ಯವಿದ್ದರೆ, ಸಂಘದ ಕಚೇರಿಯವರು ನಿಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸುತ್ತಾರೆ."

Also update the matching "already approved" error in `onboard-form.tsx:84` and any other "please contact the MDPVA office" wording aimed at approved members (grep for "contact the MDPVA").

**9. "Other" profession UX** in `onboard-form.tsx`, around L750–800:
- When the member selects Other:
  - Auto-focus `#f-prof-other` right after the change (use a `useEffect` on `values.profession === "other"`, or a `requestAnimationFrame` focus in `onChange`) and scroll it into view on mobile.
  - Render the input as visually attached to the select, with an accent border and a short highlight or animation, so it reads as a continuation.
  - Use a clear bilingual placeholder, for example "Type your profession here" / "ನಿಮ್ಮ ವೃತ್ತಿಯನ್ನು ಇಲ್ಲಿ ಬರೆಯಿರಿ".
  - Add helper text under the select: "↓ Please type your profession below".
- On submit with Other selected and the field empty, focus the field and show the error. Check what the existing error handling already does.
- Test on a mobile viewport. The member who gave the feedback was likely on a phone, where the native select closes and the new field is off screen.

---

## Verification (each agent)
- `npm run lint && npm run typecheck` (or `tsc --noEmit`) and `npx vitest run`.
- `npm run dev` and a manual check of the affected screens:
  - **A:** `/applications`, including the Approved and Rejected tabs and the detail page.
  - **B:** a submission made after 00:00 IST shows the correct day and time.
  - **C/D:** download the PDF from the member drawer. Check that it's a single page, every label is bilingual, there's no MDPVA ID, no Paid upto, "Remarks" appears, and there's a single Full name.
  - **D:** onboard form, admin member form, directory, CSV export and import.
  - **E:** `/onboard/form` at mobile width. Pick Other, confirm the input is focused, and check the approved status copy.
- **D** runs its migration against a local DB copy first (`docker-compose`) and spot-checks names.

## Open decisions for the owner
- Kannada wording for the new PDF labels (C) and the approved statement (E).
- D: whether to drop the `last_name` column now or in a later release. The plan keeps it for one release.
- A: whether rejected photos should be discarded (the plan's choice) or kept.
