# MDPVA Members

Internal members-management app for MDPVA (Mangalore District Photographers
& Videographers Association): a member directory with fees/death-fund
tracking, and a small admin panel for managing staff accounts.

## Stack

- Next.js 16 (App Router, Turbopack, RSC)
- Auth.js v5 (credentials provider, JWT sessions, RBAC)
- Drizzle ORM + Neon Postgres (serverless HTTP driver)
- Tailwind CSS v4 + shadcn/ui on `@base-ui/react`
- Vitest

## Setup

```sh
npm install --legacy-peer-deps   # peer-dep resolution can be finicky on this stack
cp .env.example .env.local       # fill in the values below
npm run db:migrate
npm run db:seed                  # creates the two seed admins
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

See `.env.example` for the same table inline.

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
