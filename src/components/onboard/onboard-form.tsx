"use client";

import * as React from "react";

import {
  ApplicationSheet,
  type SheetValues,
} from "@/components/onboard/application-sheet";
import { Button } from "@/components/ui/button";
import { DateField, isoToDisplay } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { STRINGS as S, type Bilingual } from "@/lib/onboarding/i18n";
import { cn } from "@/lib/utils";

type Values = Omit<SheetValues, "photoUrl" | "applicationNo">;

const DRAFT_KEY_PREFIX = "mdpva.onboard.draft.";

function emptyValues(membershipNo: string, prefill: Partial<Values>): Values {
  return {
    membershipNo,
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    area: "",
    pincode: "",
    city: "Mysuru",
    state: "Karnataka",
    profession: "",
    businessName: "",
    dob: "",
    bloodGroup: "",
    ...prefill,
  };
}

function Label({
  htmlFor,
  s,
  required,
}: {
  htmlFor: string;
  s: Bilingual;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="flex items-baseline gap-1.5 text-[12.5px]">
      {s.en} <span className="font-kn text-[11.5px] text-muted-foreground">{s.kn}</span>
      {required ? <span className="text-primary">*</span> : null}
    </label>
  );
}

function Group({ s, children }: { s: Bilingual; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <p className="mb-3.5 border-b border-border pb-2 text-[10.5px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {s.en} · <span className="font-kn normal-case">{s.kn}</span>
      </p>
      {children}
    </div>
  );
}

/**
 * The member-facing form. Desktop is a split view — the paper sheet fills in
 * live on the left as the form is filled on the right; below `lg` the sheet
 * collapses behind a Preview toggle rather than being duplicated.
 */
export function OnboardForm({
  membershipNo,
  prefill,
}: {
  membershipNo: string;
  prefill: Partial<Values>;
}) {
  const draftKey = `${DRAFT_KEY_PREFIX}${membershipNo}`;
  const [values, setValues] = React.useState<Values>(() =>
    emptyValues(membershipNo, prefill),
  );
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [restored, setRestored] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Restore the draft after mount. localStorage is genuinely an external system
  // and is unavailable during SSR, so this is the documented use for an effect —
  // reading it during render would desync hydration. The lint rule's usual
  // advice (derive during render) can't apply here.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Values>;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage, which cannot be read during render
      setValues((v) => ({ ...v, ...parsed, membershipNo }));
      setRestored(true);
    } catch {
      // A corrupt draft is not worth surfacing — the form still works empty.
    }
  }, [draftKey, membershipNo]);

  // Persist text fields only. The photo is deliberately never cached: a base64
  // image is both too large for localStorage and the most sensitive thing in
  // the payload, on what may well be a shared phone.
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(values));
      } catch {
        // Quota or private mode — saving is a convenience, not a requirement.
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [draftKey, values]);

  React.useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
  }

  function clearDraft() {
    window.localStorage.removeItem(draftKey);
    setValues(emptyValues(membershipNo, prefill));
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setRestored(false);
  }

  const sheet: SheetValues = {
    ...values,
    dob: values.dob ? isoToDisplay(values.dob) : "",
    photoUrl,
    applicationNo: undefined,
  };

  return (
    <div className="grid min-h-[calc(100svh-53px)] grid-cols-1 items-start lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)]">
      {/* Paper sheet — hidden below lg, shown via the Preview toggle */}
      <section
        className={cn(
          "border-b border-mdpva-border bg-[#eceae4] px-7 pt-7 pb-14 lg:block lg:min-h-full lg:border-r lg:border-b-0 dark:border-border dark:bg-[#0d0d0c]",
          showPreview ? "block" : "hidden",
        )}
      >
        <div className="mx-auto w-full max-w-[640px]">
          <p className="mb-3 ml-0.5 flex items-center gap-2 text-[11px] tracking-[0.14em] text-muted-foreground uppercase after:h-px after:flex-1 after:bg-border after:content-['']">
            {S.livePreview.en}
          </p>
          <ApplicationSheet values={sheet} />
        </div>
      </section>

      {/* The form */}
      <section className="bg-card px-6 pt-6 pb-16 sm:px-8">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-xl font-medium text-foreground">
            {S.yourDetails.en}{" "}
            <span className="font-kn text-base text-muted-foreground">
              {S.yourDetails.kn}
            </span>
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? "Hide" : S.preview.en}
          </Button>
        </div>

        {restored ? (
          <p className="mb-5 flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
            {S.draftSaved.en}{" "}
            <span className="font-kn">{S.draftSaved.kn}</span>
          </p>
        ) : null}

        <Group s={S.sectionPhoto}>
          <div className="flex items-start gap-4">
            <span
              className={cn(
                "grid w-[84px] shrink-0 place-items-center overflow-hidden rounded-md border p-1.5 text-center text-[10px] text-muted-foreground",
                photoUrl
                  ? "border-solid border-border"
                  : "border-dashed border-border bg-muted/40",
              )}
              style={{ aspectRatio: "7 / 9" }}
            >
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- blob: preview URL
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                S.noPhotoYet.en
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onPickPhoto}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  {photoUrl ? S.replacePhoto.en : S.choosePhoto.en}
                </Button>
                {photoUrl ? (
                  <Button type="button" variant="outline" size="sm" disabled>
                    {S.adjustCrop.en}
                  </Button>
                ) : null}
              </span>
              <span className="text-[11.5px] text-muted-foreground">
                {S.photoHint.en}
                <span className="font-kn mt-1 block">{S.photoHint.kn}</span>
              </span>
            </span>
          </div>
        </Group>

        <Group s={S.sectionNameContact}>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <span className="flex flex-col gap-1.5">
              <Label htmlFor="f-first" s={S.firstName} required />
              <Input
                id="f-first"
                value={values.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </span>
            <span className="flex flex-col gap-1.5">
              <Label htmlFor="f-last" s={S.lastName} required />
              <Input
                id="f-last"
                value={values.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </span>
            <span className="flex flex-col gap-1.5">
              <Label htmlFor="f-phone" s={S.phone} required />
              <Input
                id="f-phone"
                type="tel"
                inputMode="tel"
                value={values.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </span>
            <span className="flex flex-col gap-1.5">
              <Label htmlFor="f-email" s={S.email} />
              <Input
                id="f-email"
                type="email"
                placeholder={S.optional.en}
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </span>
          </div>
        </Group>

        <Group s={S.sectionAddress}>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <span className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="f-a1" s={S.addressLine1} required />
              <Input
                id="f-a1"
                value={values.addressLine1}
                onChange={(e) => set("addressLine1", e.target.value)}
              />
            </span>
            <span className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="f-a2" s={S.addressLine2} />
              <Input
                id="f-a2"
                placeholder={S.optional.en}
                value={values.addressLine2}
                onChange={(e) => set("addressLine2", e.target.value)}
              />
            </span>
            <span className="flex flex-col gap-1.5">
              <Label htmlFor="f-area" s={S.area} />
              <Input
                id="f-area"
                value={values.area}
                onChange={(e) => set("area", e.target.value)}
              />
            </span>
            <span className="flex flex-col gap-1.5">
              <Label htmlFor="f-pin" s={S.pincode} />
              <Input
                id="f-pin"
                inputMode="numeric"
                maxLength={6}
                value={values.pincode}
                onChange={(e) => set("pincode", e.target.value)}
              />
            </span>
            <span className="flex flex-col gap-1.5">
              <Label htmlFor="f-city" s={S.city} required />
              <Input
                id="f-city"
                value={values.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </span>
            <span className="flex flex-col gap-1.5">
              <Label htmlFor="f-state" s={S.state} required />
              <Input
                id="f-state"
                value={values.state}
                onChange={(e) => set("state", e.target.value)}
              />
            </span>
          </div>
        </Group>

        <Group s={S.sectionWork}>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <span className="flex flex-col gap-1.5">
              <Label htmlFor="f-prof" s={S.profession} required />
              <select
                id="f-prof"
                value={values.profession}
                onChange={(e) =>
                  set("profession", e.target.value as Values["profession"])
                }
                className="h-9 cursor-pointer rounded-lg bg-muted/50 px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="">—</option>
                <option value="photographer">
                  {S.photographer.en} · {S.photographer.kn}
                </option>
                <option value="videographer">
                  {S.videographer.en} · {S.videographer.kn}
                </option>
                <option value="both">
                  {S.both.en} · {S.both.kn}
                </option>
              </select>
            </span>
            <span className="flex flex-col gap-1.5">
              <Label htmlFor="f-biz" s={S.businessName} />
              <Input
                id="f-biz"
                value={values.businessName}
                onChange={(e) => set("businessName", e.target.value)}
              />
            </span>
            <span className="flex flex-col gap-1.5">
              <Label htmlFor="f-dob" s={S.dob} />
              <DateField
                id="f-dob"
                value={values.dob}
                onChange={(iso) => set("dob", iso)}
              />
            </span>
            <span className="flex flex-col gap-1.5">
              <Label htmlFor="f-blood" s={S.bloodGroup} />
              <select
                id="f-blood"
                value={values.bloodGroup}
                onChange={(e) => set("bloodGroup", e.target.value)}
                className="h-9 cursor-pointer rounded-lg bg-muted/50 px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="">—</option>
                {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </span>
          </div>
        </Group>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button type="button" variant="outline" size="sm" onClick={clearDraft}>
            {S.clearDraft.en}
          </Button>
          <span className="flex-1" />
          <Button type="button" disabled>
            {S.submit.en}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Submission is not wired up yet — the schema and server action land next.
        </p>
      </section>
    </div>
  );
}
