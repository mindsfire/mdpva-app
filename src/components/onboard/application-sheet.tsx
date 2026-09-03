import { MdpvaLogo } from "@/components/brand/mdpva-logo";
import { Bi } from "@/components/onboard/bilingual";
import { ORG, STRINGS as S } from "@/lib/onboarding/i18n";
import { formatPhone } from "@/lib/validation/phone";
import { cn } from "@/lib/utils";

export interface SheetValues {
  membershipNo: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  area: string;
  pincode: string;
  city: string;
  state: string;
  profession: "" | "photographer" | "videographer" | "both";
  businessName: string;
  dob: string;
  bloodGroup: string;
  photoUrl: string | null;
  applicationNo?: string;
}

const PROFESSION_LABEL: Record<string, string> = {
  photographer: `${S.photographer.en} / ${S.photographer.kn}`,
  videographer: `${S.videographer.en} / ${S.videographer.kn}`,
  both: `${S.both.en} / ${S.both.kn}`,
};

/** A filled-in value, or a dash placeholder when the member hasn't typed yet. */
function Val({
  children,
  numeric = false,
}: {
  children?: string | null;
  numeric?: boolean;
}) {
  const empty = !children;
  return (
    <span
      className={cn(
        "min-h-[19px] min-w-[3.5rem] flex-1 border-b border-dotted border-[#b9b7ac] px-1 pb-[3px] break-words",
        numeric && "tabular-nums tracking-wide",
        empty && "text-[#787770]/55",
      )}
    >
      {children || "—"}
    </span>
  );
}

function Row({
  num,
  label,
  labelKn,
  children,
}: {
  num?: string;
  label?: string;
  labelKn?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-1.5 pt-[7px] pb-[2px] text-[12px] sm:gap-2 sm:text-[13.5px]">
      <span className="w-3.5 shrink-0 font-sans text-[10px] tabular-nums text-[#787770] sm:w-5 sm:text-[11px]">
        {num}
      </span>
      {label ? (
        /*
         * `min-w-0` + wrapping label: at ~330px a `shrink-0` label pushed the
         * value out of the row, so it wrapped onto its own line with the
         * dotted rule underlining only half of it.
         */
        <span className="min-w-0 shrink text-[#45443e] sm:shrink-0">
          {label}{" "}
          {labelKn ? (
            <span className="font-kn text-[10.5px] text-[#787770] sm:text-[12px]">
              {labelKn}
            </span>
          ) : null}
        </span>
      ) : null}
      {children}
    </div>
  );
}

function Band({ en, kn }: { en: string; kn: string }) {
  return (
    <p className="mt-[18px] mb-[2px] border-b border-[#cfcdc4] pb-[5px] font-sans text-[9px] sm:mt-[22px] sm:text-[10px] tracking-[0.16em] text-[#787770] uppercase">
      {en} · <span className="font-kn normal-case">{kn}</span>
    </p>
  );
}

/**
 * The live preview: an MDPVA application sheet that fills in as the member
 * types. Chosen over an abstract "member card" because it's the artefact these
 * members have filled their whole lives — it needs no explanation, and the
 * numbered fields let office staff say "field 6 is wrong" over the phone.
 *
 * Deliberately keeps its own light palette in both themes, the way a document
 * viewer keeps the document light while the chrome goes dark.
 */
export function ApplicationSheet({ values }: { values: SheetValues }) {
  const fullName = [values.firstName, values.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <article className="relative bg-[#fdfdfb] px-5 pt-7 pb-6 font-serif sm:px-11 sm:pt-10 sm:pb-[34px] text-[#45443e] shadow-[0_1px_2px_rgba(22,21,19,.06),0_12px_32px_-8px_rgba(22,21,19,.14)] dark:brightness-[.93]">
      {/* Letterhead */}
      <div className="flex items-start gap-4">
        <span className="mt-0.5 shrink-0">
          {/* The one place the seal is large enough to read properly. */}
          <MdpvaLogo size={64} priority />
        </span>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-balance text-[15px] leading-tight font-semibold text-[#161513] sm:text-[20px]">
            {ORG.nameEn}
          </p>
          <p className="font-kn mt-[5px] text-balance text-[11.5px] leading-snug text-[#45443e] sm:text-[14.5px]">
            {ORG.nameKn}
          </p>
          <p className="mt-2 font-sans text-[10.5px] tracking-[0.05em] text-[#787770] uppercase">
            {ORG.place}
          </p>
          <p className="mt-1 text-[10px] text-[#787770] sm:text-[11px]">
            {ORG.address}
          </p>
        </div>
      </div>

      <div className="mt-4 h-1 border-t-[2.5px] border-b border-[#161513]" />

      <div className="mt-[18px] text-center">
        <h1 className="font-sans text-[14px] font-semibold tracking-[0.16em] text-[#161513] uppercase">
          {S.sheetTitle.en}
        </h1>
        <p className="font-kn mt-[5px] text-[13px] text-[#45443e]">
          {S.sheetTitle.kn}
        </p>
      </div>

      {/* Passport photo box — 7:9, the exact ratio the pipeline stores */}
      <div
        className={cn(
          /*
           * In normal flow on mobile, absolute only from `sm` up.
           *
           * The absolute position was measured against the 640px desktop
           * sheet. At ~330px the letterhead wraps to far more lines, so a
           * fixed `top` dropped the photo box straight through the
           * association name — which is what it did in production.
           */
          "mx-auto mt-4 grid w-[84px] place-items-center overflow-hidden border p-2 text-center font-sans text-[8.5px] leading-tight text-[#787770] sm:absolute sm:top-[152px] sm:right-11 sm:mx-0 sm:mt-0 sm:w-[98px]",
          values.photoUrl
            ? "border-solid border-[#cfcdc4] p-0"
            : "border-dashed border-[#b9b7ac] bg-[#b9b7ac]/5",
        )}
        style={{ aspectRatio: "7 / 9" }}
      >
        {values.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: preview URL, never a remote asset
          <img
            src={values.photoUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{S.affixPhoto.en}</span>
        )}
      </div>

      <div className="mt-5 sm:mt-[26px] sm:pr-[122px]">
        <Row num="1." label="Membership no." labelKn={S.membershipNo.kn}>
          <Val numeric>{values.membershipNo}</Val>
        </Row>
        <Row num="2." label="Name" labelKn="ಹೆಸರು">
          <Val>{fullName}</Val>
        </Row>
        <Row num="3." label="Phone" labelKn={S.phone.kn}>
          <Val numeric>{values.phone ? formatPhone(values.phone) : ""}</Val>
        </Row>
        <Row num="4." label="Email" labelKn={S.email.kn}>
          <Val>{values.email}</Val>
        </Row>
      </div>

      <Band en={S.sectionAddress.en} kn={S.sectionAddress.kn} />
      <div>
        <Row num="5.">
          <Val>{values.addressLine1}</Val>
        </Row>
        <Row>
          <Val>{values.addressLine2}</Val>
        </Row>
        <Row num="6.">
          <span className="flex flex-1 items-baseline gap-2">
            <span className="shrink-0 text-[#45443e]">Area</span>
            <Val>{values.area}</Val>
          </span>
          <span className="flex flex-1 items-baseline gap-2">
            <span className="shrink-0 text-[#45443e]">Pin</span>
            <Val numeric>{values.pincode}</Val>
          </span>
        </Row>
        <Row num="7.">
          <span className="flex flex-1 items-baseline gap-2">
            <span className="shrink-0 text-[#45443e]">City</span>
            <Val>{values.city}</Val>
          </span>
          <span className="flex flex-1 items-baseline gap-2">
            <span className="shrink-0 text-[#45443e]">State</span>
            <Val>{values.state}</Val>
          </span>
        </Row>
      </div>

      <Band en={S.profession.en} kn={S.profession.kn} />
      <div>
        <Row num="8." label="Nature of work">
          <Val>{PROFESSION_LABEL[values.profession] ?? ""}</Val>
        </Row>
        <Row num="9." label="Studio / business">
          <Val>{values.businessName}</Val>
        </Row>
        <Row num="10.">
          <span className="flex flex-1 items-baseline gap-2">
            <span className="shrink-0 text-[#45443e]">Date of birth</span>
            <Val numeric>{values.dob}</Val>
          </span>
          <span className="flex flex-1 items-baseline gap-2">
            <span className="shrink-0 text-[#45443e]">Blood group</span>
            <Val>{values.bloodGroup}</Val>
          </span>
        </Row>
      </div>

      <p className="mt-5 border-t border-[#cfcdc4] pt-4 text-[11px] leading-relaxed text-[#45443e] sm:mt-[26px] sm:text-[12.5px]">
        {S.consent.en}
        <span className="font-kn mt-1.5 block text-[12px] text-[#787770]">
          {S.consent.kn}
        </span>
      </p>

      <div className="mt-[34px] flex items-end justify-between gap-6">
        <span className="font-sans text-[12px] text-[#787770]">
          <span className="mb-[5px] block h-[26px] min-w-[108px] border-b border-[#b9b7ac]" />
          <Bi s={S.date} sep="·" />
        </span>
        <span className="font-sans text-[12px] text-[#787770]">
          <span className="mb-[5px] block h-[26px] min-w-[150px] border-b border-[#b9b7ac]" />
          <Bi s={S.signature} sep="·" />
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border border-[#cfcdc4] bg-[#b9b7ac]/[.06] px-3 py-2.5 font-sans text-[9.5px] text-[#787770] sm:mt-[26px] sm:gap-x-6 sm:px-3.5 sm:py-[11px] sm:text-[10.5px]">
        <span className="text-[9.5px] tracking-[0.13em] uppercase">
          {S.officeUse.en}
        </span>
        <span>
          Application no.{" "}
          <b className="font-semibold tabular-nums tracking-wide text-[#161513]">
            {values.applicationNo ?? "—"}
          </b>
        </span>
        <span>Verified by ______________</span>
      </div>
    </article>
  );
}
