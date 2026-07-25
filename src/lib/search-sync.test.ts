import { describe, expect, it } from "vitest";

import { reconcileSearchValue } from "./search-sync";

describe("reconcileSearchValue", () => {
  it("never touches the draft while the URL is unchanged (mid-typing)", () => {
    // Before the debounce fires, the URL still lags the draft. Adopting it
    // here would eat characters — the bug that produced `?q=v` from "kav".
    for (const draft of ["k", "ka", "kav"]) {
      const result = reconcileSearchValue({
        urlQuery: "",
        prevUrlQuery: "",
        lastPushed: null,
        draft,
      });
      expect(result).toEqual({ value: draft, changed: false });
    }
  });

  it("keeps the draft when the URL moved because of our own debounce", () => {
    // Our push of "kav" lands; the user has since typed "kavy".
    const result = reconcileSearchValue({
      urlQuery: "kav",
      prevUrlQuery: "",
      lastPushed: "kav",
      draft: "kavy",
    });
    expect(result).toEqual({ value: "kavy", changed: false });
  });

  it("adopts an external change (Clear all wipes q)", () => {
    const result = reconcileSearchValue({
      urlQuery: "",
      prevUrlQuery: "kav",
      lastPushed: "kav",
      draft: "kav",
    });
    expect(result).toEqual({ value: "", changed: true });
  });

  it("adopts an external change (back button restores an older q)", () => {
    const result = reconcileSearchValue({
      urlQuery: "bhat",
      prevUrlQuery: "kav",
      lastPushed: "kav",
      draft: "kav",
    });
    expect(result).toEqual({ value: "bhat", changed: true });
  });

  it("adopts a q arriving from a link while the box sits untouched", () => {
    const result = reconcileSearchValue({
      urlQuery: "photographer",
      prevUrlQuery: "",
      lastPushed: null,
      draft: "",
    });
    expect(result).toEqual({ value: "photographer", changed: true });
  });

  it("does not re-adopt the same external value on subsequent renders", () => {
    // After adopting, prevUrlQuery catches up and the draft is left alone,
    // so the user can immediately edit what was adopted.
    const result = reconcileSearchValue({
      urlQuery: "bhat",
      prevUrlQuery: "bhat",
      lastPushed: null,
      draft: "bhatt",
    });
    expect(result).toEqual({ value: "bhatt", changed: false });
  });
});
