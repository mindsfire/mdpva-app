"use client";

import * as React from "react";
import { Bi } from "@/components/onboard/bilingual";
import { useRouter } from "next/navigation";

import { endOnboardSessionAction } from "@/app/actions/onboard";
import { submitApplicationAction } from "@/app/actions/onboard-submit";
import { PhotoCropper } from "@/components/onboard/photo-cropper";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { XIcon } from "lucide-react";
import { ApplicationStatus } from "@/components/onboard/application-status";

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

/** Server error codes → member-facing copy. */
function submitMessage(code: string): string {
  switch (code) {
    case "session_expired":
      return "Your session timed out. Please verify again — your typed details are saved on this device.";
    case "photo_required":
      return "Please add a photograph before submitting.";
    case "photo_too_large":
      return "That image is too large. Please choose one under 8 MB.";
    case "photo_not_an_image":
      return "That file isn't a JPEG, PNG or WebP image.";
    case "photo_unreadable":
      return "That image could not be read. Please try a different photo.";
    case "submit_failed":
      return "Something went wrong saving your details. Please try again.";
    default:
      return code;
  }
}

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
export interface ExistingApplication {
  applicationNo: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  photoKey: string | null;
  /** Their own previously submitted values, safe to show back to them. */
  values: Partial<Values>;
}

export function OnboardForm({
  membershipNo,
  prefill,
  verifiedName,
  existing,
}: {
  membershipNo: string;
  prefill: Partial<Values>;
  verifiedName?: string;
  existing?: ExistingApplication | null;
}) {
  const router = useRouter();
  const draftKey = `${DRAFT_KEY_PREFIX}${membershipNo}`;
  const [values, setValues] = React.useState<Values>(() =>
    // Their own prior submission takes precedence over the sparse prefill:
    // it's data they typed, so showing it back discloses nothing new and
    // saves them re-entering everything to fix one field.
    emptyValues(membershipNo, { ...prefill, ...(existing?.values ?? {}) }),
  );
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = React.useState<Blob | null>(null);
  const [pickedFile, setPickedFile] = React.useState<File | null>(null);
  const [cropOpen, setCropOpen] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [restored, setRestored] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState<string | null>(null);
  const [consented, setConsented] = React.useState(false);
  // A returning member sees their existing application first, not a blank
  // form — otherwise they cannot tell whether the last one arrived.
  const [editing, setEditing] = React.useState(existing == null);
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
    setPickedFile(file);
    setCropOpen(true);
    // Allow re-picking the same file — without this, choosing the same photo
    // twice in a row fires no change event.
    e.target.value = "";
  }

  function onCropped(blob: Blob) {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoBlob(blob);
    setPhotoUrl(URL.createObjectURL(blob));
    setCropOpen(false);
    setPickedFile(null);
  }

  async function onSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const fd = new FormData();
      for (const [key, value] of Object.entries(values)) {
        if (key === "membershipNo") continue;
        fd.set(key, value ?? "");
      }
      if (photoBlob) fd.set("photo", photoBlob, "photo.webp");

      const result = await submitApplicationAction(fd);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      window.localStorage.removeItem(draftKey);
      setSubmitted(result.applicationNo);
    } catch {
      /*
       * A server action that *throws* — rather than returning `{ ok: false }`
       * — rejects this promise. Without this catch the rejection escaped, the
       * button simply re-enabled, and the member was left staring at a form
       * that appeared to do nothing. That is how an oversized photo upload
       * (a 500 from the body-size limit) presented in production: silently.
       *
       * Any unexpected failure now says so. The draft is deliberately left in
       * localStorage so nothing they typed is lost on a retry.
       */
      setSubmitError("submit_failed");
    } finally {
      setSubmitting(false);
    }
  }

  function clearDraft() {
    window.localStorage.removeItem(draftKey);
    setValues(emptyValues(membershipNo, prefill));
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setRestored(false);
  }

  // Served through the auth-gated route; the member's own onboarding session
  // is accepted for their own pending photo (see the photos route).
  const existingPhotoSrc = existing?.photoKey
    ? `/onboard/photo`
    : null;

  const sheet: SheetValues = {
    ...values,
    dob: values.dob ? isoToDisplay(values.dob) : "",
    // Falls back to the photo already on file, so a returning member editing
    // one field doesn't see an empty passport box and assume it was lost.
    photoUrl: photoUrl ?? existingPhotoSrc,
    applicationNo: submitted ?? existing?.applicationNo,
  };

  if (!editing && existing) {
    return (
      <ApplicationStatus
        applicationNo={existing.applicationNo}
        status={existing.status}
        submittedAt={existing.submittedAt}
        reviewedAt={existing.reviewedAt}
        rejectionReason={existing.rejectionReason}
        onEdit={() => setEditing(true)}
      />
    );
  }

  if (submitted) {
    return (
      <main className="mx-auto w-full max-w-lg px-6 py-16">
        <p className="text-xs font-medium tracking-[0.2em] text-mdpva-accent uppercase">
          MDPVA
        </p>
        <h1 className="mt-1.5 font-serif text-3xl font-medium tracking-tight text-foreground">
          {S.submittedTitle.en}
        </h1>
        <p className="font-kn mt-1 text-lg text-muted-foreground">
          {S.submittedTitle.kn}
        </p>

        <div className="mt-7 rounded-lg border border-mdpva-border bg-card px-5 py-6 text-center">
          <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
            {S.applicationNo.en}
          </p>
          <p className="mt-2 font-serif text-3xl font-medium tracking-wide text-foreground tabular-nums">
            {submitted}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {S.noteItDown.en}
            <span className="font-kn mt-1 block">{S.noteItDown.kn}</span>
          </p>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          {S.submittedBody.en}
          <span className="font-kn mt-1.5 block">{S.submittedBody.kn}</span>
        </p>

        <Button
          variant="outline"
          className="mt-7 h-10 w-full"
          onClick={async () => {
            await endOnboardSessionAction();
            router.push("/onboard");
          }}
        >
          <Bi s={S.done} sep="·" />
        </Button>
      </main>
    );
  }

  return (
    <div className="grid min-h-[calc(100svh-53px)] grid-cols-1 items-start lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)]">
      {/*
        Desktop only. Below lg the preview opens as a dialog instead of
        appearing above the form — inline, it pushed the form off-screen and
        members read it as the page having changed rather than as a preview.
      */}
      <section className="hidden border-mdpva-border bg-[#eceae4] px-7 pt-7 pb-14 lg:block lg:min-h-full lg:border-r dark:border-border dark:bg-[#0d0d0c]">
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
            onClick={() => setShowPreview(true)}
          >
            {S.preview.en}
          </Button>
        </div>

        {verifiedName ? (
          <p className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>
              Filling in as{" "}
              <b className="font-medium text-foreground">{verifiedName}</b> ·
              no. {membershipNo}
            </span>
            {/* Essential on a shared phone: the cookie is httpOnly, so this is
                the only way to hand the device back safely. */}
            <button
              type="button"
              onClick={async () => {
                window.localStorage.removeItem(draftKey);
                await endOnboardSessionAction();
                router.push("/onboard");
              }}
              className="cursor-pointer underline underline-offset-2 hover:text-foreground"
            >
              <Bi s={S.notYou} sep="·" />
            </button>
          </p>
        ) : null}

        {existing ? (
          <p className="mb-5 rounded-lg border border-mdpva-gold/40 bg-mdpva-gold/15 px-3 py-2.5 text-xs text-foreground">
            {S.editingNotice.en}{" "}
            <b className="font-medium">{existing.applicationNo}</b>
            <span className="font-kn mt-1 block text-muted-foreground">
              {S.editingNotice.kn}
            </span>
          </p>
        ) : null}

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
              ) : existingPhotoSrc ? (
                // Their already-submitted photo. Shown so they know one is on
                // file and needn't re-take it just to change an address.
                // eslint-disable-next-line @next/next/no-img-element -- auth-gated stream
                <img src={existingPhotoSrc} alt="" className="h-full w-full object-cover" />
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

        <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--color-mdpva-accent)]"
          />
          <span>
            {S.consent.en}
            <span className="font-kn mt-1 block">{S.consent.kn}</span>
          </span>
        </label>

        {submitError ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            {submitMessage(submitError)}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button type="button" variant="outline" size="sm" onClick={clearDraft}>
            {S.clearDraft.en}
          </Button>
          <span className="flex-1" />
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !consented}
          >
            {submitting ? "…" : S.submit.en}
          </Button>
        </div>
      </section>

      {/* Mobile preview: a real dialog, so it reads as an overlay you dismiss. */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[88svh] w-[calc(100%-1.5rem)] max-w-[560px] gap-0 overflow-hidden p-0 sm:max-w-[560px]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <DialogTitle className="text-sm font-medium">
              {S.livePreview.en}{" "}
              <span className="font-kn text-muted-foreground">
                {S.livePreview.kn}
              </span>
            </DialogTitle>
            <DialogClose
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Close preview" />
              }
            >
              <XIcon className="size-4" />
            </DialogClose>
          </div>
          {/* Scrolls inside the dialog; the sheet is taller than any phone. */}
          <div className="overflow-y-auto bg-[#eceae4] p-3 dark:bg-[#0d0d0c]">
            <ApplicationSheet values={sheet} />
          </div>
        </DialogContent>
      </Dialog>

      <PhotoCropper
        file={pickedFile}
        open={cropOpen}
        onCancel={() => {
          setCropOpen(false);
          setPickedFile(null);
        }}
        onCropped={onCropped}
      />
    </div>
  );
}
