import { describe, expect, it } from "vitest";

import { countChanges, diffApplication } from "./diff";

describe("diffApplication", () => {
  it("marks an unchanged field as same", () => {
    const diffs = diffApplication({ city: "Mysuru" }, { city: "Mysuru" });
    expect(diffs.find((d) => d.field === "city")?.kind).toBe("same");
  });

  it("distinguishes added from changed", () => {
    // The distinction matters: during the ledger migration nearly every field
    // is empty-to-value, so lumping them together would paint a first-time
    // submission as entirely "changed" and bury the fields worth attention.
    const diffs = diffApplication(
      { city: "Mysuru", area: null },
      { city: "Mandya", area: "Devaraja Mohalla" },
    );
    expect(diffs.find((d) => d.field === "city")?.kind).toBe("changed");
    expect(diffs.find((d) => d.field === "area")?.kind).toBe("added");
  });

  it("marks a blank optional field as kept, not cleared", () => {
    // Approval must not wipe a value the member simply didn't retype — the
    // form only prefills name and phone, so during the ledger migration this
    // is the common case, and treating it as a delete would destroy data the
    // office spent months digitising.
    const diffs = diffApplication({ email: "a@b.com" }, { email: null });
    expect(diffs.find((d) => d.field === "email")?.kind).toBe("kept");
  });

  it("treats empty string and whitespace as null, not a change", () => {
    const diffs = diffApplication({ area: null }, { area: "   " });
    expect(diffs.find((d) => d.field === "area")?.kind).toBe("same");
  });

  it("does not report a change for invisible-character-only differences", () => {
    // Otherwise a zero-width space would show as an edit an admin can't see.
    const zwsp = String.fromCodePoint(0x200b);
    const diffs = diffApplication(
      { firstName: "Aarav" },
      { firstName: `Aarav${zwsp}` },
    );
    expect(diffs.find((d) => d.field === "firstName")?.kind).toBe("same");
  });

  it("covers every diff field even when both sides are empty", () => {
    const diffs = diffApplication({}, {});
    expect(diffs).toHaveLength(14);
    expect(diffs.every((d) => d.kind === "same")).toBe(true);
  });

  it("stringifies non-string values consistently", () => {
    const diffs = diffApplication({ pincode: 570001 }, { pincode: "570001" });
    expect(diffs.find((d) => d.field === "pincode")?.kind).toBe("same");
  });
});

describe("countChanges", () => {
  it("excludes kept fields, since approval writes nothing for them", () => {
    const diffs = diffApplication(
      { email: "a@b.com", area: "Central" },
      { email: null, area: null },
    );
    expect(countChanges(diffs)).toBe(0);
  });

  it("counts only fields needing attention", () => {
    const diffs = diffApplication(
      { city: "Mysuru", area: null, email: "a@b.com" },
      { city: "Mandya", area: "Nazarbad", email: "a@b.com" },
    );
    expect(countChanges(diffs)).toBe(2);
  });

  it("is zero when nothing differs", () => {
    expect(countChanges(diffApplication({ city: "Mysuru" }, { city: "Mysuru" }))).toBe(0);
  });
});
