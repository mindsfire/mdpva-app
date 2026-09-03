# MDPVA Members

Internal members-management app for MDPVA (Mangalore District Photographers
& Videographers Association): a member directory with fees/death-fund
tracking, and a small admin panel for managing staff accounts.

## Stack

- Next.js 16 (App Router, Turbopack, RSC)
- Auth.js v5 (credentials provider, JWT sessions, RBAC)
- Drizzle ORM + Neon Postgres (serverless HTTP driver)
- Tailwind CSS v4 + shadcn/ui on `@base-ui/react`
- Cloudflare R2 (S3-compatible) for member photos, processed with `sharp`
- Vitest

## Setup

```sh
npm install --legacy-peer-deps   # peer-dep resolution can be finicky on this stack
cp .env.example .env.local       # fill in the values below
npm run bucket:up                # local MinIO for photos — see "Local dev object storage"
npm run db:migrate
npm run db:seed -- --demo        # creates the two seed admins + demo members/photos/an application
npm run dev
```

### Environment variables

Set these in `.env.local` (never commit real values):

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon Postgres connection string (`sslmode=require&channel_binding=require`). |
| `SEED_ADMIN1_EMAIL` | no (default `admin1@mdpva.org`) | Email for the first seed admin account. |
| `SEED_ADMIN1_PASSWORD` | yes, no default | Password for the first seed admin. Seeding fails loudly if unset — every environment (including local dev) must set this explicitly. |
| `SEED_ADMIN2_EMAIL` | no (default `admin2@mdpva.org`) | Email for the second seed admin account. |
| `SEED_ADMIN2_PASSWORD` | yes, no default | Password for the second seed admin, same rule as above. |
| `AUTH_SECRET` | yes | Auth.js session-encryption secret. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. |
| `R2_ACCESS_KEY_ID` | yes | Object storage access key. Local dev: `minioadmin` (see below). Deploys: R2 API token — Cloudflare dashboard → R2 → Manage API Tokens → create an **Account** token, Object Read & Write, scoped to the one bucket. |
| `R2_SECRET_ACCESS_KEY` | yes | Matching secret key. Local dev: `minioadmin`. Deploys: shown once at R2 token creation. |
| `R2_ENDPOINT` | yes | The bucket's S3 API endpoint. Local dev: `http://localhost:9000` (MinIO). Deploys: `https://<account-id>.r2.cloudflarestorage.com`. |
| `R2_BUCKET` | yes | Bucket name. Local dev: `mdpva-dev` (MinIO). Deploys: the real R2 bucket — this app writes only under the `app/members/` prefix, so it can be shared with other projects. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | no | Turnstile site key (public). Renders the widget. Absent → no widget. |
| `TURNSTILE_SECRET_KEY` | no | Turnstile secret key. Enforces the check. Absent → verification is skipped. |

See `.env.example` for the same table inline.

### Bot protection (Turnstile)

Optional, and off until both keys are set. It guards the two endpoints where
guessing has value: admin login, and the onboarding **verify** step. Not
submission — that already requires a verified session.

Turnstile works on Vercel; it is not tied to Cloudflare hosting.

1. Cloudflare dashboard → **Turnstile** → **Add site**.
2. Hostnames: `app.mdpva.org`, plus `localhost` if you want it in local dev.
3. Widget mode: **Managed** — invisible for almost all real users, which
   matters for an audience on older phones.
4. Copy both keys into Vercel → Project → Settings → Environment Variables.
5. **Redeploy.** `NEXT_PUBLIC_*` is inlined at build time, so an env change
   alone will not surface the widget.

#### Turning it off

The two keys switch different things, which matters in an incident:

| Action | Effect | Redeploy needed? |
| --- | --- | --- |
| Unset `TURNSTILE_SECRET_KEY` | **Stops blocking immediately.** Widget still shows but is no longer enforced. | No — read at runtime |
| Also unset `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Widget disappears entirely | Yes — baked in at build |

So: to unblock members fast, remove the **secret**. Remove the public key later
if you also want the widget gone.

Verification **fails closed** — if Cloudflare is unreachable, logins are
refused rather than waved through. Removing the secret key is the escape hatch.

## Member photos

Upload only from a member's edit form (editor+), once the member exists —
photos are keyed by member id (`app/members/<id>.webp`), so a new/unsaved
member has nowhere to key one to yet.

Pipeline, entirely server-side (`src/lib/photo-processing.ts`,
`src/app/actions/photo.ts`):

1. 8 MB input cap.
2. Magic-byte sniff (JPEG/PNG/WebP) — the file extension and browser
   `Content-Type` are never trusted.
3. `sharp` decodes and re-encodes to WebP, downscaled to fit 1200×1200
   (aspect ratio preserved, never upscaled, never cropped) — this also
   catches files that pass the magic-byte check but aren't real images.
4. Written to a **fixed key per member** — replacing a photo overwrites the
   same object, so storage never grows per re-upload.

The bucket is private. Photos are served through `/api/photos/[...key]`,
which requires a logged-in session and only ever serves objects under
`app/members/` — the R2 bucket itself is never public.

### Local dev object storage

Local dev never talks to the real R2 bucket. `DATABASE_URL` points at a Neon
branch (`dev-local`), which is a cheap copy-on-write clone of production —
but R2 has no equivalent per-branch isolation, it's just one bucket. Pointing
local dev's `R2_*` vars at the real bucket means any photo upload or
application approval writes to production object storage, DB branching or
not.

Instead, local dev runs a [MinIO](https://min.io) container as a throwaway
S3-compatible stand-in:

```sh
npm run bucket:up      # docker compose up -d minio minio-init
npm run db:seed -- --demo   # demo members get synthetic photos + one pending application
npm run bucket:down    # stop it; add `docker compose down -v` to also wipe the volume
```

`.env.example`/`.env.local` already point at it (`R2_ENDPOINT=http://localhost:9000`,
bucket `mdpva-dev`, credentials `minioadmin`/`minioadmin`). The MinIO web
console is at `http://localhost:9001` if you want to browse objects directly.

Never test photo-upload or application-approval flows against a real ledger
member — always use the synthetic demo members `npm run db:seed -- --demo`
creates. Doing otherwise once overwrote a real member's live R2 photo with
test data, because approving an application promotes the submitted photo
straight to that member's permanent key.

## Commands

```sh
npm run dev          # start the dev server (Turbopack)
npm run build         # production build
npm run start         # run the production build
npm run lint          # eslint — must be clean before every commit
npm run test           # vitest run (unit tests)
npm run db:generate     # generate a Drizzle migration from schema changes
npm run db:migrate      # apply migrations to DATABASE_URL
npm run db:seed         # upsert the two seed admins (add --demo for 25 sample members)
npm run bucket:up       # start local MinIO for photos (see "Local dev object storage")
npm run bucket:down     # stop it
```

## Roles

Three roles, strictly ordered `viewer < editor < admin`:

| Role | Can do |
| --- | --- |
| `viewer` | Browse/search the member directory, view profiles. |
| `editor` | Everything a viewer can, plus create/edit members. |
| `admin` | Everything an editor can, plus soft-delete members, and manage user accounts at `/users` (create users, reset passwords, change roles, enable/disable accounts). |

Every server action starts with a `requireRole(minRole)` check. Non-admins
hitting `/users` directly get a 404 (not a redirect that reveals the route
exists).

The app also enforces that there is always at least one **active** admin —
demoting the last active admin's role, or disabling the last active admin,
is blocked server-side with `Cannot remove the last admin`. A disabled
admin doesn't count toward that minimum, so disabling the second-to-last
active admin is blocked the same way.

## CSV import / export (admin)

`/import` (sidebar → Import / Export):

- **Template**: download `mdpva-import-template.csv` for the exact column
  format. `member_id` is never imported — the app generates it.
- **Import** is a two-step dry run: upload → preview (valid rows, duplicates
  against both the file and existing members, per-row validation errors) →
  confirm. Nothing is written until you confirm; duplicate/error rows are
  skipped, the rest import. Limits: 10 MB, 5,000 rows per file.
- **Export**: `Export CSV` on the Members page exports exactly the filtered
  view you're looking at; `/import` has an export-everything button.

## Deployment (Vercel)

1. Push this repo to GitHub and import it in Vercel.
2. Set env vars in Vercel: `DATABASE_URL` (Neon pooled string) and
   `AUTH_SECRET` (generate with `openssl rand -base64 32`). The `SEED_*`
   vars are **not** needed in Vercel — seeding is run once from a local
   machine with `npm run db:seed`.
3. Add `app.mdpva.org` as the project domain and point the DNS record at
   Vercel from the Cloudflare dashboard (CNAME, DNS-only/grey cloud).

## Password flows

- **New user**: an admin creates the account from `/users`; a crypto-random
  14-character temporary password (unambiguous alphabet — no `0/O/1/l/I`) is
  shown once in a dialog with a copy button, then never shown again. The
  account must change its password on first login.
- **Reset**: an admin can reset any user's password from `/users` the same
  way — this also bumps `token_version`, which invalidates every existing
  session for that user at the next session refresh (within ~15 minutes), and sets `must_change_password`.
- **Self-service change**: any signed-in user can change their own password
  from the profile menu (`/change-password`); this also bumps
  `token_version`, invalidating other sessions but not the current one.

### Break-glass password reset

If every admin account is locked out (forgotten passwords, or all admins
disabled), reset directly via the seed script — it upserts by email and
always sets `must_change_password: true`:

```sh
SEED_ADMIN1_EMAIL="you@mdpva.org" SEED_ADMIN1_PASSWORD="<new strong password>" \
SEED_ADMIN2_EMAIL="admin2@mdpva.org" SEED_ADMIN2_PASSWORD="<unchanged, still required>" \
npm run db:seed
```

This is the only account-recovery path outside the `/users` admin panel —
there's no email-based "forgot password" flow.

## Notes on this Next.js version

This repo pins a Next.js version with some breaking changes from what
training data typically assumes. See `AGENTS.md` and
`node_modules/next/dist/docs/` before making App Router changes.
