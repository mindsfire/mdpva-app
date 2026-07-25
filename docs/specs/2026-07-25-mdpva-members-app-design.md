# MDPVA Members App — Design Spec

**Date:** 2026-07-25
**Target:** app.mdpva.org (standalone; no integration with mdpva.org site in v1)
**Replaces:** old Supabase admin portal (`~/code/mdpva`) — reference only, not a replica.

## 1. Purpose

Internal member-management app for MDPVA operators (3–5 users). Stores complete
details of 1,300+ association members: identity, contact, address, profession,
fees status, death-fund coverage, and a profile photo. Lean core only — no
applications/approvals, no communications, no reports, no audit log in v1
(schema leaves hooks for a future audit log via `created_by`/`updated_by`).

## 2. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router, TypeScript, React Server Components |
| Hosting | Vercel (preview deploys per PR) |
| Database | Neon Postgres (scale-to-zero), pooled serverless driver |
| ORM / migrations | Drizzle ORM + drizzle-kit (versioned migrations in git) |
| Photos | Cloudflare R2, private bucket, S3 API from server only |
| Auth | Auth.js v5 Credentials provider, JWT session cookie (HTTP-only) |
| UI | Tailwind v4 (mdpva tokens) + shadcn/ui (Radix) + TanStack Table + react-hook-form + zod + sonner |
| Theme | next-themes — dark / light / system toggle |
| Testing | Vitest (logic) + one Playwright smoke flow in CI |

## 3. Design system

Carried from mdpva-site: Archivo (sans) + Newsreader (serif), paper `#fafaf8`,
ink `#161513`, bronze accent `#6b5b2e`, gold `#c9bc7e`, border/muted scale.
Dark mode is a first-class token set (ink-based surfaces, cream text, gold
accents adjusted for contrast — AA minimum), switched via `next-themes` with
system as default. All shadcn components re-themed to these tokens; the app
must read as the sibling of mdpva.org, not a generic admin template.

## 4. Data model

### users (app operators — separate from members)
- `id` uuid PK
- `name` text
- `email` citext UNIQUE
- `password_hash` text (bcrypt)
- `role` enum: `viewer | editor | admin`
- `status` enum: `active | disabled`
- `must_change_password` boolean default false
- `token_version` int default 1 — bumping invalidates all sessions
- `created_at`, `updated_at`

### members
Carried from old schema plus additions:
- `id` uuid PK
- `member_id` text UNIQUE — system generated `MDPVA-YYYY-NNNN`, never editable
- `legacy_id` text — optional manual old ID-card number; partial unique index
  (unique where not null and not deleted); searchable
- `first_name`, `last_name` text NOT NULL
- `email` citext, `phone` text — unique **among non-deleted rows** (partial
  indexes; fixes old-schema bug where soft-deleted rows blocked re-adding)
- `profession` enum: `photographer | videographer | both`
- `business_name` text
- `address_line1` NOT NULL, `address_line2`, `area`, `city` NOT NULL,
  `state` NOT NULL, `pincode` char(6) CHECK 6 digits
- `dob` date, `blood_group` text
- `status` enum: `active | inactive | suspended`
- `fees_paid_upto` smallint — "paid" derived as `fees_paid_upto >= current year`;
  auto-expires every Jan 1 with zero data churn
- `death_fund_covered` boolean default false
- `photo_key` text — R2 object key (not a URL)
- `notes` text
- `created_by`, `updated_by` uuid → users.id
- `created_at`, `updated_at`, `deleted_at` (soft delete)

Indexes: member_id, legacy_id, lower(name), phone, status, profession,
fees_paid_upto, deleted_at partial. Plain indexed ILIKE search is sufficient at
this scale.

### login_attempts (rate limiting)
- keyed by email and by IP; failure counters with window timestamps; enforced
  lockout with backoff. Postgres only — no Redis at this scale.

## 5. Auth & RBAC

- No self-signup. Admin-only Users page: add user (name, email, role) →
  one-time temp password displayed once → `must_change_password` forces reset
  at first login.
- Password reset: admin "Reset password" per user (new one-time temp password +
  `token_version` bump kills existing sessions). Self-service "change password"
  for logged-in users. Break-glass: CLI seed/reset script run against Neon
  directly (also creates the 2 initial admins). No email flows in v1.
- Roles enforced **inside every server action / route handler**, never only in UI:
  - **viewer**: browse/search members, view profiles + photos.
  - **editor**: viewer + create/edit members, upload photos, toggle fees/death fund.
  - **admin**: editor + soft-delete members, user management, CSV import/export.
- Login hardening: per-account and per-IP rate limits, generic "invalid
  credentials" (no enumeration), HTTP-only SameSite cookies, security headers
  (CSP, X-Frame-Options, etc.) via middleware.

## 6. Photos — R2 guardrails

- Upload path only: browser → server route → validation → R2. No client-side
  R2 access, no presigned upload URLs.
- Editor/admin only; 8 MB input cap; magic-byte content sniffing (not extension).
- `sharp` re-encode: WebP, max edge 1200px, quality tuned to ~300 KB.
- Key = `members/{member-uuid}.webp` — replace overwrites; storage is
  structurally capped at one object per member.
- Bucket private. Serving via authenticated app route with long-lived cache
  headers (`private, max-age`), so photos are never publicly enumerable.

## 7. Screens

All mobile-first (~390px), then desktop (~1440px), then 2K (content max-width
~1600px centered).

1. **Login** — greenhouse-style split. Left: paper panel, MDPVA wordmark,
   Newsreader headline, email + password, error states. Right: slow-crossfade
   slideshow of site hero images (packaged into the app; static imports).
   Mobile: slideshow becomes full-bleed background, form floats as a card.
2. **Forced password change** — shown when `must_change_password`; blocks all
   other routes.
3. **Directory** (home) — search-first sticky header (matches name, phone,
   member_id, legacy_id); filter chips: status, profession, fees due, death
   fund. Mobile: member cards (photo, name, IDs, badges) with infinite scroll.
   Desktop: TanStack table, sortable columns, same filters. Server-side
   pagination/filtering (keyset, 50/page) — never ship 1,300 rows to client.
4. **Member profile** — full details, photo, badges (status, fees, death
   fund). Desktop: sheet/side-panel over the directory (search context kept);
   mobile: full page. Edit (editor+), soft-delete with confirm (admin).
5. **Add / edit member** — sectioned form (identity / contact / address /
   association status), zod validation shared client+server, inline duplicate
   email/phone/legacy_id warning before submit.
6. **Users** (admin) — list, add, disable, reset password, role change.
7. **Change password** — self-service.
8. **CSV import** (admin) — upload → dry-run preview (valid / duplicate /
   error rows with reasons) → confirm commit. **Export** (admin) respects
   active filters.

UX baseline: loading skeletons, empty states with a next action, error toasts
with retry, optimistic UI where safe, keyboard-accessible everything (Radix),
focus-visible states, 44px touch targets on mobile.

## 8. Performance-first

- RSC by default; client components only where interactive.
- Server-side pagination + filtering; debounced search hitting an indexed query.
- `next/image` everywhere; photo thumbnails served with immutable cache headers.
- Login slideshow images statically imported, preloaded, lazy-crossfaded.
- No heavyweight client state library — URL is the state for the directory
  (shareable filtered views for free).
- Route-level loading.tsx skeletons; minimal JS on the login page.
- Neon pooled driver + Drizzle prepared statements; no N+1 (single query per view).
- Lighthouse target: ≥90 performance on directory and login, mobile.

## 9. Error handling

- zod at every boundary (forms, server actions, CSV rows, env vars via
  `@t3-oss/env-nextjs`-style validation at boot).
- Server actions return typed `{ ok, error }` results; toasts surface them.
- Global error boundary + not-found pages themed.
- DB unique violations mapped to friendly messages ("A member with this phone
  already exists").

## 10. Testing & delivery

- Vitest: RBAC guards, zod schemas, fee-status derivation, CSV parser,
  member_id generator.
- Playwright smoke: login → search → open profile → edit → logout (CI).
- GitHub repo under `mindsfire` account; PR flow with Vercel preview deploys.
- Seed script: 2 admin users + optional demo members.
- `.env.example` documenting every variable (DATABASE_URL, AUTH_SECRET,
  R2 keys/bucket/endpoint).

## 11. Out of scope (v1)

Audit log UI, applications/approvals, communications/email, reports, site
integration, OAuth/Google login, self-signup, payment-history table
(fees are a simple year flag), member self-service portal.

## 12. Milestones

1. Scaffold: Next.js 15 + Tailwind v4 tokens + shadcn theme + dark/light/system.
2. Drizzle schema + migrations + seed script (wire to Neon when details provided).
3. Auth: login page (slideshow), sessions, RBAC middleware, forced change,
   rate limiting.
4. Members: directory (mobile cards + desktop table), profile panel, add/edit.
5. Photos: R2 pipeline + serving route.
6. Users admin + password flows.
7. CSV import (dry-run) / export.
8. Polish: skeletons, empty states, 2K layout, Lighthouse pass, tests, README.

First local review build for the user lands after milestone 4 (auth + members
browsing/editing working against Neon; photos/CSV may be stubbed).
