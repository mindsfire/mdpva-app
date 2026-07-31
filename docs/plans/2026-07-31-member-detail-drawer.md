# Member Detail Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the modal member peek on desktop with a Lens-style non-modal docked drawer, so the directory stays visible and clickable while a member's complete record is read.

**Architecture:** At `lg` and above the members page becomes a flex row — table region (`overflow-x:auto`, sticky name column) · drag handle · drawer. Below `lg` the existing modal `Sheet` is untouched. A small client context owns the current page's member ids so row clicks and `↑`/`↓` swap the drawer without dimming the table. Field composition moves into a pure function so it can be tested in a node environment.

**Tech Stack:** Next.js 16 App Router (`proxy.ts`, not `middleware.ts`), React 19, Tailwind v4, shadcn on `@base-ui` (uses `render` prop, never `asChild`), Drizzle + Neon Postgres, Vitest (`environment: "node"`).

## Global Constraints

- **Spec:** `docs/specs/2026-07-31-member-detail-drawer.md`. Every task's requirements implicitly include it.
- **Breakpoint:** drawer only at `lg` (1024px) and above. Below `lg` behaviour must not change.
- **`MIN_TABLE_WIDTH = 480`**, `PEEK_MIN_WIDTH = 384` (unchanged), `PEEK_MAX_WIDTH = 900` (unchanged).
- **No column may be dropped or hidden** when the drawer is open — horizontal scroll only.
- **Every field renders always**; empty values show `—`. Nothing is conditionally hidden.
- **No new dependencies.** `vitest.config.ts` is `environment: "node"` — do not add jsdom or testing-library.
- **Testing against production data.** `.env.local` points at the live Neon database. Exercise viewing, resizing and switching only — never Edit or Delete.
- **Commits:** `Type - description` (`Feature`, `Fix`, `Chore`, `Docs`). **Never** add `Co-Authored-By` or any AI attribution trailer.
- **Lint before commit:** `npm run lint` must pass; CI fails on lint errors.
- Never commit to `main`; this work lives on `feature/member-drawer`.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/peek-prefs.ts` | *Modify.* Add `MIN_TABLE_WIDTH` and a container-aware `clampPeekWidth`. |
| `src/lib/peek-prefs.test.ts` | *Create.* Clamp maths, including the 1024px boundary. |
| `src/lib/member-sections.ts` | *Create.* Pure `buildMemberSections(member)` — the single source of truth for which fields the drawer shows. |
| `src/lib/member-sections.test.ts` | *Create.* Locks down "nothing disappears when null". |
| `src/lib/members-query.ts` | *Modify.* `MemberDetail` gains `createdAt`, `updatedAt`, `updatedByName`; `getMemberById` left-joins `users`. |
| `src/components/members/member-drawer-nav.tsx` | *Create.* Client context: current page ids, active id, open/next/prev/close, pending flag, keyboard handling. |
| `src/components/members/member-drawer.tsx` | *Create.* The docked panel itself (`lg`+ only). |
| `src/components/members/sheet-resizer.tsx` | *Modify.* Accept a container element so the max width can depend on it. |
| `src/components/members/member-profile-view.tsx` | *Modify.* Render from `buildMemberSections`; add the Record section. |
| `src/components/members/member-table.tsx` | *Modify.* Row click via the nav context, active-row highlight, sticky name column. |
| `src/app/(app)/members/page.tsx` | *Modify.* Flex layout, drawer at `lg`+, sheet below `lg`. |

---

### Task 1: Container-aware width clamp

**Files:**
- Modify: `src/lib/peek-prefs.ts`
- Test: `src/lib/peek-prefs.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `MIN_TABLE_WIDTH: number`, `clampPeekWidth(px: number, containerWidth?: number): number`. Passing no `containerWidth` keeps today's behaviour, so existing callers are unaffected.

- [ ] **Step 1: Write the failing test**

Create `src/lib/peek-prefs.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  clampPeekWidth,
  MIN_TABLE_WIDTH,
  PEEK_MAX_WIDTH,
  PEEK_MIN_WIDTH,
} from "./peek-prefs";

describe("clampPeekWidth", () => {
  it("keeps a comfortable width unchanged", () => {
    expect(clampPeekWidth(600)).toBe(600);
  });

  it("clamps below the minimum up to the minimum", () => {
    expect(clampPeekWidth(100)).toBe(PEEK_MIN_WIDTH);
  });

  it("clamps above the maximum down to the maximum", () => {
    expect(clampPeekWidth(5000)).toBe(PEEK_MAX_WIDTH);
  });

  it("rounds fractional widths", () => {
    expect(clampPeekWidth(600.6)).toBe(601);
  });

  describe("with a container width", () => {
    // The drawer must never squeeze the table below MIN_TABLE_WIDTH.
    it("leaves at least MIN_TABLE_WIDTH for the table", () => {
      expect(clampPeekWidth(900, 1200)).toBe(1200 - MIN_TABLE_WIDTH);
    });

    it("still honours the absolute maximum on a very wide screen", () => {
      expect(clampPeekWidth(5000, 3000)).toBe(PEEK_MAX_WIDTH);
    });

    // At the lg breakpoint both minimums fit exactly: 1024 - 480 = 544.
    it("allows 544px at the lg breakpoint", () => {
      expect(clampPeekWidth(900, 1024)).toBe(544);
    });

    // Below lg the drawer isn't rendered, but the maths must not return
    // something smaller than the minimum if it is ever called.
    it("never returns less than the minimum, even in an impossible container", () => {
      expect(clampPeekWidth(900, 700)).toBe(PEEK_MIN_WIDTH);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/peek-prefs.test.ts`
Expected: FAIL — `MIN_TABLE_WIDTH` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/peek-prefs.ts`, add the constant after `PEEK_MAX_WIDTH`:

```ts
/**
 * The narrowest the members table may become while the drawer is open.
 * Chosen to keep the sticky name column plus two more columns visible; the
 * remaining columns stay reachable by scrolling, never dropped.
 */
export const MIN_TABLE_WIDTH = 480;
```

Replace `clampPeekWidth` with:

```ts
/**
 * Clamp a drawer width to the allowed range.
 *
 * When `containerWidth` is supplied the ceiling also depends on it, so the
 * drawer can never squeeze the table below `MIN_TABLE_WIDTH`. The floor still
 * wins: in a container too narrow to satisfy both, the minimum is returned
 * rather than something unusably small.
 */
export function clampPeekWidth(px: number, containerWidth?: number): number {
  const ceiling =
    containerWidth === undefined
      ? PEEK_MAX_WIDTH
      : Math.min(PEEK_MAX_WIDTH, containerWidth - MIN_TABLE_WIDTH);
  return Math.max(PEEK_MIN_WIDTH, Math.min(ceiling, Math.round(px)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/peek-prefs.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Check nothing else regressed**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/peek-prefs.ts src/lib/peek-prefs.test.ts
git commit -m "Feature - clamp drawer width against the table's minimum"
```

---

### Task 2: Pure field composition

**Files:**
- Create: `src/lib/member-sections.ts`
- Test: `src/lib/member-sections.test.ts`

**Interfaces:**
- Consumes: `MemberDetail` from `@/lib/members-query`.
- Produces:
  - `interface DetailField { label: string; value: string | number | null }`
  - `interface MemberSection { title: string; fields: DetailField[] }`
  - `buildMemberSections(member: MemberDetail): MemberSection[]`

This runs before Task 3, so it must not reference `createdAt`/`updatedAt`/`updatedByName` yet — Task 4 adds the Record section once those fields exist.

- [ ] **Step 1: Write the failing test**

Create `src/lib/member-sections.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildMemberSections } from "./member-sections";
import type { MemberDetail } from "./members-query";

function member(overrides: Partial<MemberDetail> = {}): MemberDetail {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    memberId: "MDPVA-2026-0001",
    legacyId: "42",
    firstName: "Asha",
    lastName: "Rao",
    email: "asha@example.com",
    phone: "9000000001",
    profession: "photographer",
    businessName: "Asha Studio",
    addressLine1: "5 Temple St",
    addressLine2: "Near the tank",
    area: "Lakshmipuram",
    city: "Mysuru",
    state: "Karnataka",
    pincode: "570001",
    dob: "1980-01-31",
    bloodGroup: "O+",
    status: "active",
    feesPaidUpto: 2026,
    deathFundCovered: true,
    photoKey: null,
    notes: "Imported from the paper ledger.",
    ...overrides,
  };
}

const flatten = (m: MemberDetail) =>
  buildMemberSections(m).flatMap((s) => s.fields);

describe("buildMemberSections", () => {
  it("splits address line 1 and line 2 into separate fields", () => {
    const labels = flatten(member()).map((f) => f.label);
    expect(labels).toContain("Address line 1");
    expect(labels).toContain("Address line 2");
  });

  it("includes notes as a field", () => {
    const notes = flatten(member()).find((f) => f.label === "Notes");
    expect(notes?.value).toBe("Imported from the paper ledger.");
  });

  // The regression this file exists to prevent: a member with nothing filled
  // in must still show every row, so "empty" is never mistaken for "hidden".
  it("returns the same fields when every optional value is null", () => {
    const full = flatten(member()).map((f) => f.label);
    const empty = flatten(
      member({
        legacyId: null,
        email: null,
        phone: null,
        profession: null,
        businessName: null,
        addressLine2: null,
        area: null,
        pincode: null,
        dob: null,
        bloodGroup: null,
        feesPaidUpto: null,
        notes: null,
      }),
    ).map((f) => f.label);

    expect(empty).toEqual(full);
  });

  it("surfaces empty values as null for the caller to render", () => {
    const fields = flatten(member({ notes: null, email: null }));
    expect(fields.find((f) => f.label === "Notes")?.value).toBeNull();
    expect(fields.find((f) => f.label === "Email")?.value).toBeNull();
  });

  it("maps profession to its display label", () => {
    const value = flatten(member({ profession: "both" })).find(
      (f) => f.label === "Profession",
    )?.value;
    expect(value).toBe("Photo & Video");
  });

  it("renders death fund cover as words, not a boolean", () => {
    expect(
      flatten(member({ deathFundCovered: false })).find(
        (f) => f.label === "Death fund",
      )?.value,
    ).toBe("Not covered");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/member-sections.test.ts`
Expected: FAIL — cannot resolve `./member-sections`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/member-sections.ts`:

```ts
import type { MemberDetail } from "@/lib/members-query";

export interface DetailField {
  label: string;
  /** `null` means "recorded as empty" — callers render an em-dash. */
  value: string | number | null;
}

export interface MemberSection {
  title: string;
  fields: DetailField[];
}

export const PROFESSION_LABELS: Record<
  NonNullable<MemberDetail["profession"]>,
  string
> = {
  photographer: "Photographer",
  videographer: "Videographer",
  both: "Photo & Video",
};

/**
 * The drawer's field list, as data.
 *
 * Extracted from the component for the same reason `buildMembersWhere` was
 * extracted from `searchMembers`: it makes the mapping testable in this
 * project's node test environment, with no jsdom or testing-library.
 *
 * Every field is listed unconditionally. Empty values are `null` rather than
 * omitted — a member with nothing filled in must still show every row, or
 * "empty" becomes indistinguishable from "not shown here", which is exactly
 * the confusion this redesign exists to fix.
 */
export function buildMemberSections(member: MemberDetail): MemberSection[] {
  return [
    {
      title: "Contact",
      fields: [
        { label: "Email", value: member.email },
        { label: "Phone", value: member.phone },
      ],
    },
    {
      title: "Address",
      fields: [
        { label: "Address line 1", value: member.addressLine1 },
        { label: "Address line 2", value: member.addressLine2 },
        { label: "Area", value: member.area },
        { label: "City", value: member.city },
        { label: "State", value: member.state },
        { label: "Pincode", value: member.pincode },
      ],
    },
    {
      title: "Association",
      fields: [
        {
          label: "Profession",
          value: member.profession
            ? PROFESSION_LABELS[member.profession]
            : null,
        },
        { label: "Business", value: member.businessName },
        { label: "Date of birth", value: member.dob },
        { label: "Blood group", value: member.bloodGroup },
        { label: "Fees paid upto", value: member.feesPaidUpto },
        {
          label: "Death fund",
          value: member.deathFundCovered ? "Covered" : "Not covered",
        },
      ],
    },
    {
      title: "Notes",
      fields: [{ label: "Notes", value: member.notes }],
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/member-sections.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/member-sections.ts src/lib/member-sections.test.ts
git commit -m "Feature - extract member drawer field composition as data"
```

---

### Task 3: Record history in the member query

**Files:**
- Modify: `src/lib/members-query.ts` (the `MemberDetail` interface, and `getMemberById`)

**Interfaces:**
- Produces: `MemberDetail` gains `createdAt: Date`, `updatedAt: Date`, `updatedByName: string | null`.

No migration: `created_at`, `updated_at` and `updated_by` already exist on `members`.

- [ ] **Step 1: Extend the type**

In `src/lib/members-query.ts`, add to the `MemberDetail` interface after `notes`:

```ts
  createdAt: Date;
  updatedAt: Date;
  /**
   * Display name of the admin who last changed this record, or null when no
   * person has — every ledger-imported member has `updated_by` null because a
   * script wrote them. A dash in the UI is therefore meaningful: it marks a
   * record untouched since the import.
   */
  updatedByName: string | null;
```

- [ ] **Step 2: Import `users` and rewrite the query**

At the top of the file, extend the schema import:

```ts
import { members, users } from "@/db/schema";
```

Replace the body of `getMemberById` (the `db.select()` call and the returned object) with:

```ts
  const [row] = await db
    .select({
      member: members,
      updatedByName: users.name,
    })
    .from(members)
    // Left join: `updated_by` is null for every imported member, and an inner
    // join would silently return "not found" for all 1307 of them.
    .leftJoin(users, eq(members.updatedBy, users.id))
    .where(and(eq(members.id, id), isNull(members.deletedAt)))
    .limit(1);

  if (!row) return null;

  const { member, updatedByName } = row;

  return {
    id: member.id,
    memberId: member.memberId,
    legacyId: member.legacyId,
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    phone: member.phone,
    profession: member.profession,
    businessName: member.businessName,
    addressLine1: member.addressLine1,
    addressLine2: member.addressLine2,
    area: member.area,
    city: member.city,
    state: member.state,
    pincode: member.pincode,
    dob: member.dob,
    bloodGroup: member.bloodGroup,
    status: member.status,
    feesPaidUpto: member.feesPaidUpto,
    deathFundCovered: member.deathFundCovered,
    photoKey: member.photoKey,
    notes: member.notes,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    updatedByName,
  };
```

- [ ] **Step 3: Verify it compiles and nothing regressed**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
Expected: all pass. If `tsc` reports a missing `eq`/`and`/`isNull` import, add it to the existing `drizzle-orm` import at the top of the file.

- [ ] **Step 4: Verify against real data**

There is no database-backed test harness in this project, so confirm the join by hand:

```bash
cat > /tmp/check-detail.ts <<'EOF'
import { getMemberById } from "../../src/lib/members-query";
import { db } from "../../src/db";
import { members } from "../../src/db/schema";
import { isNull } from "drizzle-orm";

async function main() {
  const [row] = await db.select({ id: members.id }).from(members).where(isNull(members.deletedAt)).limit(1);
  const detail = await getMemberById(row!.id);
  console.log({
    createdAt: detail?.createdAt,
    updatedAt: detail?.updatedAt,
    updatedByName: detail?.updatedByName,
  });
}
main().then(() => process.exit(0));
EOF
cp /tmp/check-detail.ts .local/check-detail.ts && npx tsx .local/check-detail.ts && rm .local/check-detail.ts
```

Expected: two real dates, and `updatedByName: null` (imported members have no human editor).

- [ ] **Step 5: Commit**

```bash
git add src/lib/members-query.ts
git commit -m "Feature - expose record history on the member detail query"
```

---

### Task 4: Record section and always-render profile view

**Files:**
- Modify: `src/lib/member-sections.ts`, `src/lib/member-sections.test.ts`
- Modify: `src/components/members/member-profile-view.tsx`

**Interfaces:**
- Consumes: `buildMemberSections` (Task 2), `MemberDetail.createdAt/updatedAt/updatedByName` (Task 3).
- Produces: profile view rendered entirely from `buildMemberSections`, plus a "Record" section.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/member-sections.test.ts` (and add the three fields to the `member()` factory: `createdAt: new Date("2026-07-31T10:00:00Z"), updatedAt: new Date("2026-07-31T12:00:00Z"), updatedByName: "Priya",`):

```ts
describe("record section", () => {
  it("includes created, updated and who last changed it", () => {
    const record = buildMemberSections(member()).find(
      (s) => s.title === "Record",
    );
    expect(record?.fields.map((f) => f.label)).toEqual([
      "Created",
      "Last updated",
      "Last updated by",
    ]);
  });

  it("formats dates as a readable day", () => {
    const record = buildMemberSections(member()).find((s) => s.title === "Record");
    expect(record?.fields[0]?.value).toBe("31 Jul 2026");
  });

  // Imported members were written by a script, so this is the common case.
  it("leaves the editor null when no person has touched the record", () => {
    const record = buildMemberSections(member({ updatedByName: null })).find(
      (s) => s.title === "Record",
    );
    expect(record?.fields[2]?.value).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/member-sections.test.ts`
Expected: FAIL — no section titled "Record".

- [ ] **Step 3: Add the section**

In `src/lib/member-sections.ts`, add above `buildMemberSections`:

```ts
/** Stable, unambiguous day format — avoids 07/08 being read either way round. */
function formatDay(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}
```

Then append this section to the returned array, after `Notes`:

```ts
    {
      title: "Record",
      fields: [
        { label: "Created", value: formatDay(member.createdAt) },
        { label: "Last updated", value: formatDay(member.updatedAt) },
        { label: "Last updated by", value: member.updatedByName },
      ],
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/member-sections.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Render the view from the data**

In `src/components/members/member-profile-view.tsx`, replace the whole `<div className="flex flex-col gap-4">…</div>` block (the Contact / Address / Association / Notes sections, currently lines ~110-176) with:

```tsx
      <div className="flex flex-col gap-4">
        {buildMemberSections(member).map((section) => (
          <div key={section.title}>
            <h3 className="pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {section.title}
            </h3>
            {/* Notes can be long prose; everything else is short pairs. */}
            {section.title === "Notes" ? (
              <p className="text-sm whitespace-pre-wrap text-foreground">
                {section.fields[0]?.value ?? "—"}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
                {section.fields.map((field) => (
                  <Detail
                    key={field.label}
                    label={field.label}
                    value={field.value}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
```

Add the import:

```ts
import { buildMemberSections } from "@/lib/member-sections";
```

Delete the now-unused local `PROFESSION_LABELS` constant (it moved to `member-sections.ts`). Keep `Detail` — it already renders `—` for null.

Add `@container` to the root element so `@sm:grid-cols-2` responds to the drawer's width rather than the viewport:

```tsx
    <div className="@container flex flex-col gap-6">
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
Expected: all pass. If `tsc` flags `PROFESSION_LABELS` still in use elsewhere in the file, import it from `@/lib/member-sections` instead of deleting the usage.

- [ ] **Step 7: Commit**

```bash
git add src/lib/member-sections.ts src/lib/member-sections.test.ts src/components/members/member-profile-view.tsx
git commit -m "Feature - always render every member field and add record history"
```

---

### Task 5: Drawer navigation context

**Files:**
- Create: `src/components/members/member-drawer-nav.tsx`

**Interfaces:**
- Produces:
  - `MemberDrawerNavProvider({ ids, activeId, children })`
  - `useMemberDrawerNav(): { activeId, isPending, open(id), close(), next(), prev() }`

Deliberately separate from `DirectoryTransitionProvider`: that one dims the whole results area while pending, which is right for pagination but wrong here — the list must stay readable while the drawer swaps.

- [ ] **Step 1: Create the context**

```tsx
"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface MemberDrawerNav {
  activeId: string | null;
  /** True while the next member's data is being fetched. */
  isPending: boolean;
  open: (id: string) => void;
  close: () => void;
  next: () => void;
  prev: () => void;
}

const Context = React.createContext<MemberDrawerNav | null>(null);

export function useMemberDrawerNav(): MemberDrawerNav {
  const context = React.useContext(Context);
  if (!context) {
    throw new Error(
      "useMemberDrawerNav must be used within MemberDrawerNavProvider",
    );
  }
  return context;
}

/**
 * Owns which member the drawer is showing.
 *
 * Selection lives in the URL (`?member=<id>`) so deep links and browser
 * back/forward keep working, but navigation runs inside a transition scoped to
 * the drawer — unlike `DirectoryTransitionProvider`, which dims the entire
 * results area. Dimming the list on every arrow-key step would defeat the
 * point of keeping it visible.
 */
export function MemberDrawerNavProvider({
  ids,
  activeId,
  children,
}: {
  /** Member ids in the order the current page renders them. */
  ids: string[];
  activeId: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const go = React.useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("member", id);
      else params.delete("member");
      const query = params.toString();
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname);
      });
    },
    [pathname, router, searchParams],
  );

  const step = React.useCallback(
    (delta: number) => {
      if (!activeId) return;
      const index = ids.indexOf(activeId);
      if (index === -1) return;
      const target = ids[index + delta];
      // Deliberately does not paginate: stepping past the last row on a page
      // would change the list under the user without them asking.
      if (target) go(target);
    },
    [activeId, go, ids],
  );

  const value = React.useMemo<MemberDrawerNav>(
    () => ({
      activeId,
      isPending,
      open: (id: string) => go(id),
      close: () => go(null),
      next: () => step(1),
      prev: () => step(-1),
    }),
    [activeId, go, isPending, step],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * Keyboard control for the drawer. Rendered only when the drawer is open.
 *
 * Ignores events originating in a text field or with a modifier held, so
 * typing in the search box and native shortcuts are unaffected.
 */
export function MemberDrawerKeys() {
  const { next, prev, close } = useMemberDrawerNav();

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        prev();
      } else if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, next, prev]);

  return null;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit && npm run lint`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/members/member-drawer-nav.tsx
git commit -m "Feature - add member drawer navigation context"
```

---

### Task 6: Container-aware resizer

**Files:**
- Modify: `src/components/members/sheet-resizer.tsx`

**Interfaces:**
- Produces: `SheetResizer({ panelRef, containerRef? })`. Without `containerRef` behaviour is exactly as today, so `MemberSheet` (mobile) needs no change.

- [ ] **Step 1: Accept an optional container**

Change the signature and the two `clampPeekWidth` calls:

```tsx
export function SheetResizer({
  panelRef,
  containerRef,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  /**
   * When supplied, the drawer's maximum width also depends on this element's
   * width, so it can never squeeze the table below `MIN_TABLE_WIDTH`. The
   * modal sheet on mobile passes nothing and keeps the viewport-based ceiling.
   */
  containerRef?: React.RefObject<HTMLDivElement | null>;
}) {
```

Inside `onPointerDown`, replace the initial width line:

```tsx
      const containerWidth = containerRef?.current?.getBoundingClientRect().width;
      let width = clampPeekWidth(
        panel.getBoundingClientRect().width,
        containerWidth,
      );
```

and the move handler:

```tsx
      function onMove(moveEvent: PointerEvent) {
        // The panel is right-anchored, so its width is the distance from the
        // pointer to the container's right edge.
        const right =
          containerRef?.current?.getBoundingClientRect().right ??
          window.innerWidth;
        width = clampPeekWidth(right - moveEvent.clientX, containerWidth);
        panel!.style.width = `${width}px`;
        panel!.style.maxWidth = `${width}px`;
      }
```

Add `containerRef` to the `useCallback` dependency array: `[panelRef, containerRef]`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
Expected: pass. `MemberSheet` still compiles because `containerRef` is optional.

- [ ] **Step 3: Commit**

```bash
git add src/components/members/sheet-resizer.tsx
git commit -m "Feature - let the resizer clamp against its container"
```

---

### Task 7: The docked drawer

**Files:**
- Create: `src/components/members/member-drawer.tsx`

**Interfaces:**
- Consumes: `useMemberDrawerNav`, `MemberDrawerKeys` (Task 5), `SheetResizer` (Task 6), `MemberProfileView` (Task 4), `clampPeekWidth`/`PEEK_MIN_WIDTH` (Task 1).
- Produces: `MemberDrawer({ member, role, initialWidth, containerRef })`.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/rbac";
import type { MemberDetail } from "@/lib/members-query";
import { MemberProfileView } from "@/components/members/member-profile-view";
import { SheetResizer } from "@/components/members/sheet-resizer";
import {
  MemberDrawerKeys,
  useMemberDrawerNav,
} from "@/components/members/member-drawer-nav";
import { clampPeekWidth, PEEK_MIN_WIDTH } from "@/lib/peek-prefs";

/**
 * Non-modal member detail panel docked to the right of the directory.
 *
 * Deliberately not a `Sheet`: the Radix sheet is modal, so it dimmed the
 * table, trapped focus, and had to be closed before another member could be
 * opened. A plain panel keeps the list visible and clickable, which is the
 * whole point of the redesign (see
 * docs/specs/2026-07-31-member-detail-drawer.md).
 */
export function MemberDrawer({
  member,
  role,
  initialWidth,
  containerRef,
}: {
  member: MemberDetail | null;
  role: Role;
  initialWidth?: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { close, isPending } = useMemberDrawerNav();

  const width = clampPeekWidth(initialWidth ?? PEEK_MIN_WIDTH);
  const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`;

  return (
    <div
      ref={panelRef}
      style={{ width, maxWidth: width }}
      className="relative shrink-0 overflow-y-auto rounded-lg border border-mdpva-border p-4 dark:border-border"
      aria-label="Member details"
      aria-busy={isPending}
    >
      <SheetResizer panelRef={panelRef} containerRef={containerRef} />
      <MemberDrawerKeys />

      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {isPending ? (
            <span className="flex items-center gap-1.5">
              <Loader2Icon className="size-3 animate-spin" />
              Loading…
            </span>
          ) : (
            "↑ ↓ to move · Esc to close"
          )}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={close}
          aria-label="Close member details"
        >
          <XIcon />
        </Button>
      </div>

      {/* Dimmed rather than replaced while loading: swapping to a skeleton on
          every arrow-key step would flash the whole panel. */}
      <div className={cn("transition-opacity", isPending && "opacity-50")}>
        {member ? (
          <MemberProfileView
            member={member}
            role={role}
            editHref={`/members/${member.id}/edit?back=${encodeURIComponent(currentUrl)}`}
            onDeleted={close}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Member not found.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit && npm run lint`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/members/member-drawer.tsx
git commit -m "Feature - add the non-modal docked member drawer"
```

---

### Task 8: Table — active row, sticky name, horizontal scroll

**Files:**
- Modify: `src/components/members/member-table.tsx`

**Interfaces:**
- Consumes: `useMemberDrawerNav` (Task 5).

- [ ] **Step 1: Route row clicks through the drawer context**

Replace the `openMember` function and its `router`/`pathname`/`searchParams` hooks with the context:

```tsx
  const { activeId, open } = useMemberDrawerNav();
```

Delete the now-unused `useRouter`, `usePathname`, `useSearchParams` imports and the local `openMember` definition, then change the row's handler to `onClick={() => open(row.id)}`.

- [ ] **Step 2: Mark the active row and pin the name column**

Change the `<TableRow>` for data rows to:

```tsx
          <TableRow
            key={row.id}
            onClick={() => open(row.id)}
            aria-current={activeId === row.id ? "true" : undefined}
            className={cn(
              "cursor-pointer",
              activeId === row.id &&
                "bg-mdpva-gold/15 dark:bg-mdpva-gold/10",
            )}
          >
```

Add `import { cn } from "@/lib/utils";`.

Give the name header and cell a sticky left edge so horizontal scrolling never hides which row is which. On `<TableHead>Name</TableHead>`:

```tsx
          <TableHead className="sticky left-0 z-20 bg-mdpva-white dark:bg-card">
            Name
          </TableHead>
```

and on the name `<TableCell>`:

```tsx
            <TableCell className="sticky left-0 z-10 bg-inherit">
```

- [ ] **Step 3: Give the table a minimum width**

Wrap the returned `<Table>` so columns are never squeezed away:

```tsx
    <div className="overflow-x-auto">
      <Table className="min-w-[880px]">
        …
      </Table>
    </div>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/members/member-table.tsx
git commit -m "Feature - highlight the active row and keep every column reachable"
```

---

### Task 9: Wire the page layout

**Files:**
- Modify: `src/app/(app)/members/page.tsx`
- Create: `src/components/members/members-directory-layout.tsx`

**Interfaces:**
- Consumes: everything above.

The container ref must live in a client component (a server component cannot hold a ref), so the flex row is its own small client wrapper.

- [ ] **Step 1: Create the layout wrapper**

```tsx
"use client";

import * as React from "react";

import type { Role } from "@/lib/rbac";
import type { MemberDetail } from "@/lib/members-query";
import { MemberDrawer } from "@/components/members/member-drawer";
import { MemberDrawerNavProvider } from "@/components/members/member-drawer-nav";

/**
 * Desktop directory shell: results on the left, drawer docked right.
 *
 * Exists as a client component only because the resizer needs a ref to the
 * row that bounds it — the table and rows inside `children` stay server
 * components.
 */
export function MembersDirectoryLayout({
  ids,
  activeId,
  member,
  role,
  initialWidth,
  children,
}: {
  ids: string[];
  activeId: string | null;
  member: MemberDetail | null;
  role: Role;
  initialWidth?: number;
  children: React.ReactNode;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  return (
    <MemberDrawerNavProvider ids={ids} activeId={activeId}>
      <div ref={containerRef} className="flex items-start gap-4">
        <div className="min-w-0 flex-1">{children}</div>
        {activeId ? (
          // The drawer is desktop-only; below lg the modal sheet still runs,
          // because 384 + 480 doesn't fit under 864px.
          <div className="hidden lg:block">
            <MemberDrawer
              member={member}
              role={role}
              initialWidth={initialWidth}
              containerRef={containerRef}
            />
          </div>
        ) : null}
      </div>
    </MemberDrawerNavProvider>
  );
}
```

- [ ] **Step 2: Use it in the page**

In `src/app/(app)/members/page.tsx`, wrap the existing results block. Replace:

```tsx
            <div className="flex flex-col gap-5">
              <DirectoryResults>
```

with:

```tsx
            <MembersDirectoryLayout
              ids={rows.map((row) => row.id)}
              activeId={memberParam ?? null}
              member={selectedMember}
              role={sessionUser.role}
              initialWidth={peekWidth}
            >
            <div className="flex flex-col gap-5">
              <DirectoryResults>
```

and close it after the `</MembersPagination>`'s parent `</div>`, before `</MembersSelectionProvider>`:

```tsx
            </MembersDirectoryLayout>
```

Add the import:

```ts
import { MembersDirectoryLayout } from "@/components/members/members-directory-layout";
```

- [ ] **Step 3: Restrict the old sheet to below `lg`**

Still in `page.tsx`, change the sheet render so the two never appear at once:

```tsx
      {memberParam ? (
        <div className="lg:hidden">
          <MemberSheet
            member={selectedMember}
            role={sessionUser.role}
            initialWidth={peekWidth}
          />
        </div>
      ) : null}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/members/page.tsx src/components/members/members-directory-layout.tsx
git commit -m "Feature - dock the member drawer beside the directory on desktop"
```

---

### Task 10: Verify in a real browser

**Files:** none — verification only.

Per the project's standing rule, both platforms are checked in a real browser, not assumed.

**Reminder:** `.env.local` points at the production database. Do not use Edit or Delete.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Desktop checks at ~1440px**

Load `/members`, sign in, then confirm each:

- Clicking a row opens the drawer with **no dimming**; the table stays fully readable.
- Clicking a *different* row swaps the drawer without closing it.
- `↓` and `↑` step through members; `Esc` closes.
- Typing in the search box does **not** trigger arrow stepping.
- Every column (through Death Fund) is reachable by scrolling the table sideways; the Name column stays pinned.
- Dragging the divider widens the drawer but **stops** before the table gets narrower than ~480px.
- Reloading keeps the drawer width.
- A member with empty fields shows `—` for each, and the Notes and Record sections are present.
- `Record` shows Created, Last updated, and `—` for Last updated by.

- [ ] **Step 3: Tablet check at ~900px**

Confirm the modal sheet appears — not the drawer — and behaves as before.

- [ ] **Step 4: Mobile check at ~390px**

Confirm the card list and modal sheet are unchanged.

- [ ] **Step 5: Report findings**

Report what was verified, with anything that looked wrong, before opening a PR. Do not claim success for a check that was not actually run.

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| §2 Layout, `lg` gate | 9 |
| §3 Table: scroll, sticky name, active row | 8 |
| §4 Resizing, dynamic clamp | 1, 6 |
| §5 Switching, arrow keys, Esc, pending | 5, 7 |
| §6 Drawer contents, always-render, split address | 2, 4 |
| §7 Data changes | 3 |
| §8 Testing | 1, 2, 4, 10 |
| §9 Prod-data caution | Global Constraints, 10 |

**Type consistency** — `clampPeekWidth(px, containerWidth?)` defined in Task 1 and used with two arguments in Task 6; `buildMemberSections` returns `MemberSection[]` in Task 2 and is consumed as such in Task 4; `useMemberDrawerNav` returns `{ activeId, isPending, open, close, next, prev }` in Task 5 and only those members are used in Tasks 7 and 8; `SheetResizer`'s `containerRef` is optional in Task 6 so the mobile `MemberSheet` call site in Task 9 stays valid.

**Known risk** — Task 8's `min-w-[880px]` and Task 1's `MIN_TABLE_WIDTH = 480` are independent numbers. 880 is the table's natural minimum with all nine columns; 480 is how much of it must stay on screen. They are intentionally different, and Task 10 checks the result by eye.
