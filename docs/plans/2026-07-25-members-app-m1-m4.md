# MDPVA Members App — Milestones 1–4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First locally reviewable build: themed scaffold, Neon schema + seed, credentials auth with greenhouse login, members directory/profile/add-edit. Photos + CSV stubbed.

**Architecture:** Next.js 15 App Router (RSC-first) on `~/code/mdpva-app`. Drizzle ORM against Neon pooled driver. Auth.js v5 credentials + JWT cookie, RBAC enforced in server actions. UI = Tailwind v4 mdpva tokens + shadcn/ui + TanStack Table. URL-as-state directory with server-side pagination.

**Tech Stack:** next@15, react@19, typescript, tailwindcss@4, drizzle-orm, drizzle-kit, @neondatabase/serverless, next-auth@5 (beta), bcryptjs, zod, react-hook-form, @tanstack/react-table, next-themes, sonner, vitest.

## Global Constraints

- Design tokens copied verbatim from mdpva-site `global.css` (`--color-mdpva-*`, Archivo/Newsreader); dark theme is a hand-tuned token set, `next-themes` with system default.
- All mutations in server actions with per-action role checks (`viewer|editor|admin`); UI hiding is never the only guard.
- Server-side pagination (50/page); never ship full member list to client.
- `DATABASE_URL` only in `.env.local` (gitignored) + documented in `.env.example`. Never commit secrets.
- Commit style: `Feature - ...` / `Fix - ...` / `Chore - ...`; no AI attribution trailers.
- Mobile-first (390px), desktop 1440px, content max-width 1600px for 2K.

---

### Task 1: Scaffold + design system + theme switch

**Files:** create Next app in repo root (`create-next-app@latest` with TS/Tailwind/App Router, src dir, import alias `@/*`); `src/app/globals.css` (tokens), `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx`; shadcn init (`components.json`); `.env.example`.

**Steps:**
- [ ] `npx create-next-app@latest . --ts --tailwind --app --src-dir --import-alias "@/*" --no-eslint-strict` (accept defaults otherwise); verify `npm run dev` serves.
- [ ] Port mdpva tokens into `globals.css` `@theme` (copy from `~/code/mdpva-site/src/styles/global.css`), add dark-mode overrides under `.dark` (paper→#141310 surfaces, ink→cream text, gold adjusted #d8cd96, borders #2a2925 scale) and map shadcn CSS vars (`--background`, `--foreground`, `--primary`=accent, `--radius: 0.25rem`) for both themes. Load Archivo + Newsreader via `next/font/google` in `src/app/layout.tsx`.
- [ ] `npx shadcn@latest init` then `npx shadcn@latest add button input label select dialog sheet dropdown-menu badge table skeleton form sonner tabs separator avatar`.
- [ ] Add `next-themes` ThemeProvider (attribute="class", defaultTheme="system") in layout + a theme-toggle dropdown (light/dark/system).
- [ ] Smoke check dev server renders a test page with serif headline + accent button in both themes; delete boilerplate.
- [ ] Commit `Feature - scaffold with mdpva design tokens and theme switching`.

### Task 2: Drizzle schema, Neon wiring, seed script

**Files:** `src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`, `scripts/seed.ts`, `.env.local` (user-provided DATABASE_URL), `src/lib/env.ts` (zod-validated env).

**Interfaces (produced):**
- `db` (drizzle instance, neon-http driver), tables `users`, `members`, `loginAttempts` per spec §4 (exact columns/enums as spec; `roleEnum = pgEnum('user_role', ['viewer','editor','admin'])`, `professionEnum`, `memberStatusEnum`, `userStatusEnum`).
- `generateMemberId(year: number, seq: number): string` → `MDPVA-YYYY-NNNN` in `src/lib/member-id.ts`; seq from `members_seq` Postgres sequence.
- `isFeesPaid(feesPaidUpto: number | null, now?: Date): boolean` in `src/lib/fees.ts`.

**Steps:**
- [ ] Install `drizzle-orm @neondatabase/serverless drizzle-kit dotenv bcryptjs zod`; write schema exactly per spec §4 including partial unique indexes: `uniqueIndex('members_email_active').on(sql`lower(email)`).where(sql`deleted_at is null and email is not null`)`, same for phone and legacy_id; citext via `customType` or `text` + lower() indexes (use lower() indexes — avoids extension dependency).
- [ ] Vitest setup; failing tests for `generateMemberId(2026, 42) === 'MDPVA-2026-0042'` and `isFeesPaid(2026)` truth table (null→false, past year→false, current/future→true, respects injected `now`). Implement; tests green.
- [ ] `drizzle-kit generate` + `drizzle-kit migrate` against Neon (`.env.local`); verify with `drizzle-kit studio` or a select.
- [ ] `scripts/seed.ts` (tsx): upsert 2 admins (emails/passwords from env `SEED_ADMIN1_EMAIL/PASSWORD`, `SEED_ADMIN2_...`; bcrypt cost 12, `must_change_password: true`) + `--demo` flag inserting 25 demo members covering all statuses/professions/fee states. Run it; verify rows.
- [ ] Commit `Feature - drizzle schema, neon migrations, admin seed script`.

### Task 3: Auth — login, sessions, RBAC, rate limiting, forced change

**Files:** `src/auth.ts` (NextAuth config), `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`, `src/app/(auth)/login/page.tsx` + `login-form.tsx` + `slideshow.tsx`, `src/app/(auth)/change-password/page.tsx`, `src/lib/rbac.ts`, `src/lib/rate-limit.ts`, `src/app/actions/auth.ts`, hero images copied from mdpva-site `public/uploads/hero-*.jpg` → `src/assets/login/`.

**Interfaces (produced):**
- `auth()` session helper; session JWT carries `{ userId, role, tokenVersion, mustChangePassword }`; JWT callback re-checks `token_version` against db every 15 min (`updateAge`) and kills stale sessions.
- `requireRole(minRole: 'viewer'|'editor'|'admin'): Promise<SessionUser>` in `rbac.ts` — throws/redirects on failure; role order viewer<editor<admin. **All later tasks call this first in every server action.**
- `checkRateLimit(email: string, ip: string)` / `recordFailure` / `clearFailures` in `rate-limit.ts`: 5 failures per email per 15 min OR 20 per IP → locked with exponential backoff message (generic copy).
- `changePasswordAction(current, next)` — validates zod (min 10 chars), bcrypt-verifies, updates hash, clears `must_change_password`, bumps nothing.

**Steps:**
- [ ] Vitest for `rbac` ordering and rate-limit window logic (pure functions, db calls injected); implement to green.
- [ ] NextAuth credentials provider: normalize email, rate-limit check, bcrypt compare, status==='active' check, generic error always; middleware protects everything except `/login` + auth routes; `mustChangePassword` in session → middleware redirects all routes to `/change-password`.
- [ ] Login page: greenhouse split — left 480px paper form panel (wordmark, Newsreader headline "Members Portal", email/password, submit with pending state, error slot); right flex-1 slideshow (client component: static-imported hero images, 6s crossfade via opacity + `next/image` fill, priority on first). Mobile: slideshow absolute full-bleed + dark scrim, form floats as card. Theme toggle in corner.
- [ ] Manual verify: bad creds generic error; 6th bad attempt locked; good login lands on `/`; forced change flow works then redirects to `/`.
- [ ] Commit `Feature - credentials auth with rbac, rate limiting, greenhouse login`.

### Task 4: App shell + members directory

**Files:** `src/app/(app)/layout.tsx` (shell: top bar w/ wordmark, search, theme toggle, profile menu w/ change-password + logout; content max-w-[1600px]), `src/app/(app)/page.tsx` (directory RSC), `src/components/members/member-card.tsx`, `member-table.tsx`, `filters.tsx`, `search-input.tsx` (debounced, writes URL params), `src/lib/members-query.ts`, `src/app/(app)/loading.tsx`.

**Interfaces:**
- Consumes `db`, `requireRole`, `isFeesPaid`.
- Produces `searchMembers(params: { q?, status?, profession?, feesDue?, deathFund?, sort?, cursor? }): Promise<{ rows: MemberRow[], nextCursor: string | null }>` — keyset pagination on `(last_name, id)`, 50/page, `deleted_at is null`, `q` ILIKE-matches name/phone/member_id/legacy_id. `MemberRow` = id, memberId, legacyId, firstName, lastName, phone, profession, status, feesPaidUpto, deathFundCovered, photoKey.

**Steps:**
- [ ] Vitest for query-param → SQL-filter mapping (pure builder function extracted).
- [ ] Directory RSC: reads searchParams, calls `searchMembers` after `requireRole('viewer')`. Desktop ≥md: TanStack table (name+photo avatar initials fallback, member_id/legacy_id, phone, profession, status badge, fees badge red "Due"/green "Paid YYYY", death-fund badge). Mobile: card list, "Load more" cursor button (server-navigated, keeps URL state). Filter chips + sort write URL params. Empty state ("No members match — clear filters").
- [ ] `loading.tsx` skeleton rows; verify with seeded demo members at 390/1440/2560 widths.
- [ ] Commit `Feature - app shell and members directory with filters`.

### Task 5: Member profile + add/edit + soft delete

**Files:** `src/app/(app)/members/[id]/page.tsx` (mobile full page), `src/components/members/member-sheet.tsx` (desktop sheet triggered from table row, URL `?member=<id>` so it deep-links), `member-form.tsx` (sectioned RHF+zod), `src/app/actions/members.ts`, `src/lib/validation/member.ts` (shared zod schema), `src/components/members/delete-dialog.tsx`, stub `src/components/members/photo-uploader.tsx` (disabled dropzone labeled "Photos arrive in milestone 5").

**Interfaces:**
- Consumes `requireRole`, `db`, `generateMemberId`.
- Produces server actions: `createMember(input: MemberInput)` (editor+; generates member_id; maps unique violations to `{ ok:false, field, error }`), `updateMember(id, input)` (editor+; sets `updated_by`), `softDeleteMember(id)` (admin; sets `deleted_at`), `checkDuplicates(email?, phone?, legacyId?)` (returns matches for pre-submit warning). `MemberInput` = zod-inferred type from `member.ts` covering all spec §4 editable fields (member_id excluded).

**Steps:**
- [ ] Vitest for member zod schema (pincode regex, enum values, optional legacy_id trims to null) and unique-violation mapper.
- [ ] Profile view: header (photo/initials, name, both IDs, status/fees/death-fund badges), detail sections (contact / address / association: profession, business, dob, blood group, fees year, death fund, notes), Edit button (editor+), Delete (admin, confirm dialog naming the member).
- [ ] Form: 4 sections, inline errors, duplicate warning banner on blur via `checkDuplicates`, fees field = year select (current±5) + "mark paid for 2026" quick action, submit → toast + revalidate directory.
- [ ] Manual verify full CRUD as admin; verify viewer sees no edit affordances AND server actions reject a viewer (test by temporary role swap).
- [ ] Commit `Feature - member profile, create/edit forms, soft delete`.

### Task 6: Users admin + password flows + review polish

**Files:** `src/app/(app)/users/page.tsx`, `src/components/users/user-form-dialog.tsx`, `reset-password-dialog.tsx`, `src/app/actions/users.ts`, `src/lib/temp-password.ts`, `src/app/error.tsx`, `src/app/not-found.tsx`, `README.md`.

**Interfaces:**
- Produces `createUser(name, email, role)` (admin; returns `{ tempPassword }` shown once), `resetUserPassword(id)` (admin; new temp password + `token_version + 1` + `must_change_password: true`), `setUserStatus(id, status)`, `setUserRole(id, role)` — all guard against demoting/disabling the last active admin (`{ ok:false, error:'Cannot remove the last admin' }`).
- `generateTempPassword(): string` — 14 chars, crypto-random, unambiguous alphabet.

**Steps:**
- [ ] Vitest: temp password charset/length, last-admin guard logic.
- [ ] Users page (admin-only route + `requireRole('admin')` in every action): table of users w/ role/status, add dialog (temp password reveal with copy button), per-row menu (reset password, change role, disable). Non-admins get 404 on `/users`.
- [ ] Themed `error.tsx`/`not-found.tsx`; README: setup, env vars, seed, run; `.env.example` complete.
- [ ] Full manual pass at 390/1440/2560 both themes; `npm run build` clean; commit `Feature - user management and password flows`.

---

## Self-review notes

- Spec coverage M1–M4: §2 stack (T1–T2), §3 theme (T1), §4 schema (T2), §5 auth/RBAC (T3, T6), §7 screens 1–7 (T3–T6; screen 8 CSV + §6 photos deliberately stubbed = milestones 5+ per spec §12), §8 perf (RSC, keyset pagination, static slideshow imports baked into T3/T4), §9 errors (T5 mapper, T6 boundaries), §10 seed/README (T2/T6).
- Types traced: `MemberRow` (T4) ⊂ members table (T2); `MemberInput` (T5) matches editable spec fields; `requireRole` signature identical T3→T6.
