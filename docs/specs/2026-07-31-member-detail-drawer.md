# Desktop Member Detail Drawer — Design Spec

**Date:** 2026-07-31
**Status:** Locked — ready to plan
**Related:** [MDPVA Members App design](./2026-07-25-mdpva-members-app-design.md)

### Locked decisions

| Question | Decision |
|---|---|
| Layout | **Lens-style docked drawer.** Non-modal, docked right, resizable by dragging its left edge. |
| Table behaviour when the drawer widens | **Shrink and scroll horizontally.** No column is ever dropped or hidden. |
| Mobile and tablet | **Unchanged.** Below `lg` the existing modal sheet stays exactly as-is. |
| Field visibility | **Every field always renders.** Empty values show an em-dash; nothing is conditionally hidden. |
| Record history | **Included** — created, last updated, and the admin who last changed it. |
| Prefetching neighbours | **Not now.** Server-driven fetch with a pending state; revisit only if it feels slow in use. |
| Local dev database | **Points at production, accepted for this feature.** Neon branch deferred — see §9. |

---

## 1. Problem

On desktop, clicking a member opens `MemberSheet` — a Radix `Sheet`, which is
modal. It dims and blocks the directory behind it, traps focus, and has to be
closed before another member can be opened. Reviewing members one after another
means a close/open cycle for each, and the list is never visible alongside the
member being read.

The panel is also narrow (384px minimum), which makes it read as though it is
showing partial data.

**It is not, in fact, showing partial data.** Every stored member field is
already rendered. The impression comes from three specific things:

1. **Notes disappear when empty.** The section is wrapped in
   `member.notes ? … : null`, so "no notes" is indistinguishable from "notes
   aren't shown here". 700 of 1307 members carry notes, so this is hit often.
2. **Address lines are merged.** `addressLine1` and `addressLine2` are joined
   with a comma into a single "Address" field, so which text lives in which
   column is invisible — exactly what you need before deciding to edit.
3. **Cramping reads as truncation.**

**Goal:** read a member's complete record without leaving the directory, and
move between members without closing anything. Edit is for editing only — never
a means of discovering what a record contains.

---

## 2. Layout

At `lg` (1024px) and above the members page becomes a horizontal flex region:

```
┌────────────────────────────────────┬─┬─────────────────┐
│ table region (flex, min 480px)     │║│ drawer (cookie) │
│ overflow-x: auto                   │║│                 │
└────────────────────────────────────┴─┴─────────────────┘
                                      ↑ drag handle
```

The drawer is a plain panel, not a `Sheet`. That single change removes the
overlay, the dimming, and the focus trap together.

Below `lg` nothing changes: the existing modal `Sheet` renders over whatever
the viewport already shows — the card list on phones, the table on tablets,
exactly as today. Both branches stay driven by the same `?member=<id>` search
param, so deep links and back/forward behaviour are unaffected.

**Why `lg` and not `md`:** the drawer's minimum (384px) plus the table's
minimum (480px, §4) is 864px. At the `md` breakpoint of 768px both constraints
cannot hold at once, so the drawer only takes over once there is genuinely room
for it. Tablets keep the modal sheet, which suits them better anyway.

When no member is selected the table region occupies the full width, as today.

---

## 3. Table behaviour

- The table region gets `overflow-x: auto`; the table keeps a `min-width` so
  columns are never dropped to fit. Every column stays reachable by scrolling.
- The **name column is sticky-left**, so horizontal scrolling never leaves you
  unsure which row you are reading.
- The selected row keeps a persistent highlight. Today's row selection styling
  only exists for the modal's lifetime.
- Row click swaps the drawer's contents in place rather than opening anything.

---

## 4. Resizing

Reuses `SheetResizer` and the `member_peek_width` cookie in `peek-prefs.ts`;
both already exist and already persist for a year.

One change: `clampPeekWidth` currently has a fixed 900px ceiling. It becomes
dependent on the container:

```
maxWidth = min(PEEK_MAX_WIDTH, containerWidth - MIN_TABLE_WIDTH)
```

with `MIN_TABLE_WIDTH = 480`. The drawer therefore cannot squeeze the table
below a usable width. 480 is a starting value, chosen to keep the sticky name
column plus two more columns visible; tune it against real use.

`PEEK_MIN_WIDTH` (384) is unchanged.

---

## 5. Switching between members

- Clicking any visible row swaps the drawer contents.
- `↑` / `↓` move to the previous/next member **within the current page** of
  results. They do not paginate.
- `Esc` closes the drawer.
- Keyboard handlers must not fire while focus is in the search box or any
  other input.

The drawer's data is server-fetched per URL change via the existing
`getMemberById`. Arrow-key stepping will therefore make a request per step.
This is accepted for now: it reuses existing code and preserves deep linking.
A subtle pending treatment covers the latency rather than a spinner that would
flash on fast connections.

**Explicitly not built:** prefetching neighbouring members. If stepping feels
sluggish in real use it is a contained follow-up, but building it speculatively
adds cache-invalidation complexity for a problem that may not exist.

---

## 6. Drawer contents

Every field renders unconditionally. Empty values show `—`. Nothing is hidden
based on whether it has a value.

| Section | Fields |
|---|---|
| Identity | photo, name, member ID, legacy ID, status / fees / death-fund badges |
| Contact | email, phone |
| Address | **address line 1**, **address line 2** (separate), area, city, state, pincode |
| Association | profession, business name, date of birth, blood group, fees paid upto, death fund |
| Notes | full text, `—` when empty |
| Record | created, last updated, last updated by |

Two changes from today beyond always-render: address lines are split into their
own fields, and the Record section is new.

The drawer's internal grid moves from one column to two as it widens, so extra
width buys readability rather than longer line lengths.

Edit and Delete stay where they are. Edit continues to link out to the full
page — a drawer is still too narrow for the form.

---

## 7. Data changes

`MemberDetail` gains three fields:

- `createdAt: Date`
- `updatedAt: Date`
- `updatedByName: string | null`

`getMemberById` left-joins `users` on `members.updatedBy` for the name. The
join is left-outer because `updated_by` is null for every one of the 1307
ledger-imported members — they were written by a script, not a person. Those
rows display "—", which is itself meaningful: it marks a record no human has
touched since the import.

No other caller reads these fields, and no schema migration is required —
`created_at`, `updated_at` and `updated_by` all already exist on the table.

---

## 8. Testing

**Unit**

- `clampPeekWidth` with a dynamic maximum: clamps to `container − 480` and
  never returns less than `PEEK_MIN_WIDTH`. Includes the boundary case at
  exactly 1024px, where the two minimums leave 544px for the drawer.
- `getMemberById`'s three new fields are covered by the type checker and by
  manual verification against real data; there is no database-backed test
  harness in this project, and adding one is out of scope here.

**Field composition**

`vitest.config.ts` runs `environment: "node"` with no jsdom or testing-library,
so component rendering cannot be asserted without adding dependencies. Rather
than add them, the section/field list is extracted into a pure function
(`buildMemberSections`) that the component maps over — the same pattern the
codebase already uses for `buildMembersWhere`, which was extracted from
`searchMembers` to be testable without a live database.

- `buildMemberSections` returns every field in §6 for a fully populated member.
- It returns the same field count for a member whose optional values are all
  null — this is the "nothing silently disappears" regression, and it is the
  one worth locking down.
- Empty values surface as `null` for the component to render as `—`.
- Address line 1 and line 2 appear as two separate entries.

**Browser** — required, per the project's standing rule that both platforms are
verified:

- Desktop ~1440px: drawer opens without dimming; the table stays scrollable and
  clickable; all columns reachable; row click and arrow keys swap members;
  divider drags and the width survives a reload.
- Tablet ~900px: modal sheet, unchanged — confirms the `lg` gate holds.
- Mobile ~390px: unchanged modal behaviour.

---

## 9. Local development against production data

`.env.local` resolves to the same Neon database the deployed app uses. Local
testing is therefore **not** isolated from production.

For this feature that is accepted deliberately: the change is read-only, and
real names and photos make the layout easier to judge than seeded data. The
admins are not yet using the app, so there is no concurrent-use risk.

**Constraint while testing:** the drawer contains Edit and Delete controls.
Both write to production from localhost. Testing exercises viewing, resizing
and switching only.

**Follow-up (not in this spec):** create a Neon branch database for local
development before any feature that writes data is built.

---

## 10. Out of scope

- Comparing two members side by side.
- Prefetching or client-side caching of member records (§5).
- Any change to mobile.
- Any change to the edit form.
- Column visibility preferences or user-configurable table columns.
