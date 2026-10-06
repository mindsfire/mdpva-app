import fs from "node:fs";
import path from "node:path";

import {
  Document,
  Font,
  Image,
  Page,
  Path,
  renderToBuffer,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { memberApplications, members } from "@/db/schema";
import { joinAddressLines } from "@/lib/address";
import { formatDateIST, isoToDisplay } from "@/lib/format-date";
import { fullName } from "@/lib/member-name";
import { professionLabel } from "@/lib/profession";
import { ORG, STRINGS as S } from "@/lib/onboarding/i18n";
import { ORG_NAME_KN_OUTLINE } from "@/lib/pdf/org-name-kn.generated";
import { fetchMemberPhotoForPdf, type PdfPhoto } from "@/lib/pdf/photo-for-pdf";
import { maskAadhaar } from "@/lib/validation/aadhaar";

type Member = typeof members.$inferSelect;
type Application = typeof memberApplications.$inferSelect;

// Read as raw bytes rather than referencing by URL/import path: this module
// runs only inside the PDF route handler's Node runtime, never bundled for
// the browser, so there's no benefit to going through Next's asset
// pipeline — and `fs.readFileSync(path.join(process.cwd(), "literal"))` is
// the pattern Next's build-time file tracing (and Vercel's function
// bundling) reliably picks up for including non-JS files in the deployed
// function. If a deploy ever 404s on these, add them to
// `outputFileTracingIncludes` in next.config.ts.
const ASSETS_DIR = path.join(process.cwd(), "src/assets");

/**
 * Kannada glyphs need an embedded font — the built-in PDF standard fonts
 * (Helvetica/Times) only cover Latin text, and unlike a browser, a PDF
 * viewer never substitutes a system font for missing glyphs. Noto Sans
 * Kannada (OFL-licensed, google/fonts) is the only variable instance
 * upstream ships; react-pdf/fontkit embeds it as a single default (Regular)
 * instance, which is all the <Text> here needs. The one bold Kannada line,
 * the letterhead's org name, is drawn from pre-shaped outlines instead (see
 * `OrgNameKn`).
 */
Font.register({
  family: "NotoSansKannada",
  src: path.join(ASSETS_DIR, "fonts/NotoSansKannada.ttf"),
});

const logoBuffer = fs.readFileSync(path.join(ASSETS_DIR, "brand/mdpva-logo.png"));

/**
 * Redirect-free counterpart to `getApplicationForReview` in
 * `src/app/actions/applications.ts`. That function is a `"use server"`
 * action whose first line, `requireRole("admin")`, calls Next's `redirect()`
 * on failure — correct for a Server Component page, wrong for a binary-file
 * `GET` route (which needs a bare 404, per this app's export/photo route
 * convention). The route handler does its own auth check first, then calls
 * this instead of the action.
 */
export async function getApplicationForPdf(
  applicationId: string,
): Promise<{ application: Application; member: Member } | null> {
  const [application] = await db
    .select()
    .from(memberApplications)
    .where(eq(memberApplications.id, applicationId))
    .limit(1);
  if (!application) return null;

  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, application.memberId))
    .limit(1);
  if (!member) return null;

  return { application, member };
}

/**
 * Backs the "Download application" button on the member drawer/detail/edit
 * pages, where the caller has a member id, not an application id — and,
 * unlike `getApplicationForPdf`, works for every member, not only ones with
 * an approved application: a member's current record is always downloadable
 * from the member side, since `buildApplicationPdfSections` only ever reads
 * off the `members` row, never the application's own (partial, possibly
 * stale) fields.
 *
 * `application` is `null` for a member who never submitted one at all — the
 * common case for anyone imported straight from the paper ledger. The
 * template renders an em-dash for the application number in that case. When
 * one exists, the *latest* is used regardless of status, so a rejected or
 * still-pending submission's reference number shows rather than nothing;
 * `reviewedAt` is only surfaced when that latest application is approved
 * (see `renderApplicationPdfForRecord`).
 */
export async function getMemberForPdf(
  memberId: string,
): Promise<{ application: Application | null; member: Member } | null> {
  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, memberId), isNull(members.deletedAt)))
    .limit(1);
  if (!member) return null;

  const [application] = await db
    .select()
    .from(memberApplications)
    .where(eq(memberApplications.memberId, memberId))
    .orderBy(desc(memberApplications.createdAt))
    .limit(1);

  return { application: application ?? null, member };
}

export interface PdfField {
  label: string;
  /** Only set where an official, already-reviewed translation exists in
   * `STRINGS` — this module never invents Kannada copy of its own. */
  labelKn?: string;
  /** `null` means "recorded as empty" — the template renders an em-dash. */
  value: string | number | null;
  /** Bilingual counterpart to `value`, same reviewed-only rule as `labelKn`.
   * Only used where the value itself is a fixed, translatable word (e.g.
   * "Covered"), never for freeform member-entered text. */
  valueKn?: string;
  /** Spans the full row instead of sharing it with a neighbour — for long
   * freeform text (address lines, remarks) that would wrap badly in half
   * the width. */
  wide?: boolean;
}

export interface PdfSection {
  title: string;
  titleKn?: string;
  fields: PdfField[];
}

/**
 * The approved-application PDF's field list, built from the raw `members`
 * row — by the time an application is approved, the `members` row is the
 * authoritative current record, so this reads directly off it rather than
 * off the (partial, potentially stale) application fields.
 *
 * Every field renders unconditionally, `null` for "recorded as empty" —
 * same convention as `buildMemberSections` and the review page's diff table
 * (`d.current ?? "—"`), so a sparse ledger-imported member still shows every
 * row instead of a suspiciously short document.
 */
export function buildApplicationPdfSections(member: Member): PdfSection[] {
  return [
    {
      title: "Identity",
      titleKn: S.sectionIdentity.kn,
      fields: [
        {
          label: "Full name",
          labelKn: S.fullName.kn,
          // Capitals on the printed form only, so the name reads clearly when
          // checked against the photo; the stored name keeps its casing.
          value: fullName(member.firstName).toUpperCase() || null,
        },
        {
          label: "Date of birth",
          labelKn: S.dob.kn,
          value: member.dob ? isoToDisplay(member.dob) : null,
        },
        { label: "Blood group", labelKn: S.bloodGroup.kn, value: member.bloodGroup },
        {
          label: "Aadhaar",
          labelKn: S.aadhaar.kn,
          // Masked, same as the member drawer/CSV export — this document
          // never has access to the encrypted value to unmask it.
          value: member.aadhaarLast4 ? maskAadhaar(member.aadhaarLast4) : null,
        },
      ],
    },
    {
      title: "Contact",
      titleKn: S.sectionContact.kn,
      fields: [
        { label: "Email", labelKn: S.email.kn, value: member.email },
        { label: "Phone", labelKn: S.phone.kn, value: member.phone },
      ],
    },
    {
      title: "Address",
      titleKn: S.sectionAddress.kn,
      fields: [
        {
          label: "Address",
          labelKn: S.address.kn,
          // Older records may still carry a line 2; shown as one address,
          // matching the single field on the form.
          value: joinAddressLines(member.addressLine1, member.addressLine2) || null,
          wide: true,
        },
        { label: "Area", labelKn: S.area.kn, value: member.area },
        { label: "City", labelKn: S.city.kn, value: member.city },
        { label: "State", labelKn: S.state.kn, value: member.state },
        { label: "Pincode", labelKn: S.pincode.kn, value: member.pincode },
      ],
    },
    {
      title: "Association",
      fields: [
        {
          label: "Profession",
          labelKn: S.profession.kn,
          value: professionLabel(member.profession, member.professionOther),
        },
        { label: "Business", labelKn: S.businessName.kn, value: member.businessName },
      ],
    },
    {
      title: "Membership",
      titleKn: S.sectionMembership.kn,
      fields: [
        { label: "Membership no.", labelKn: S.membershipNo.kn, value: member.legacyId },
        { label: "Status", labelKn: S.status.kn, value: member.status },
        {
          label: "Death fund",
          labelKn: S.deathFund.kn,
          value: member.deathFundCovered
            ? S.deathFundCovered.en
            : S.deathFundNotCovered.en,
          valueKn: member.deathFundCovered
            ? S.deathFundCovered.kn
            : S.deathFundNotCovered.kn,
        },
        {
          // One row, not a section of its own: the layout is sized to fit one
          // A4 page (#37) and a separate three-row section pushed it onto two.
          // Wide: name, relationship and phone break awkwardly in half a row.
          label: "Nominee",
          labelKn: S.sectionNominee.kn,
          value: formatNominee(member),
          wide: true,
        },
      ],
    },
    {
      // "Remarks" in the PDF only — the drawer (member-sections.ts) still
      // calls this field "Notes".
      title: S.remarks.en,
      titleKn: S.remarks.kn,
      fields: [
        { label: S.remarks.en, labelKn: S.remarks.kn, value: member.notes, wide: true },
      ],
    },
  ];
}

/** "Lakshmi Rao (Spouse) · 9845022345", dropping whichever parts are missing. */
export function formatNominee(
  member: Pick<Member, "nomineeName" | "nomineeRelationship" | "nomineePhone">,
): string | null {
  const who = [
    member.nomineeName,
    member.nomineeRelationship ? `(${member.nomineeRelationship})` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const parts = [who, member.nomineePhone].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

const INK = "#161513";
const BODY = "#45443e";
const MUTED = "#787770";
const BORDER = "#e5e1d6";
const RULE = "#cfcdc4";

const styles = StyleSheet.create({
  page: {
    // 24, not 28: the page was exactly full, and the nominee row (plus
    // headroom for long wrapped values) needed the space.
    padding: 24,
    fontSize: 10,
    fontFamily: "Times-Roman",
    color: BODY,
  },

  // Letterhead — mirrors the onboarding live-preview sheet's header
  // (src/components/onboard/application-sheet.tsx) so the two documents
  // read as one format: same seal, same bilingual org name, same address.
  letterhead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  logoBlock: { alignItems: "center" },
  logo: { width: 52, height: 52 },
  regNo: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: MUTED,
    marginTop: 3,
  },
  letterheadText: { flex: 1, alignItems: "center" },
  // Kannada leads (see OrgNameKn), English is the subheading.
  orgNameEn: {
    fontFamily: "Times-Roman",
    fontSize: 11,
    textAlign: "center",
    color: BODY,
    marginTop: 3,
  },
  orgPlace: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
    color: MUTED,
    marginTop: 6,
  },
  orgAddress: {
    fontSize: 8,
    textAlign: "center",
    color: MUTED,
    marginTop: 2,
  },
  ruleThick: { marginTop: 8, borderTopWidth: 2, borderTopColor: INK },
  ruleThin: { marginTop: 1, borderTopWidth: 0.75, borderTopColor: RULE },

  titleBlock: { marginTop: 8, alignItems: "center" },
  titleEn: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textAlign: "center",
    color: INK,
  },
  titleKn: {
    fontFamily: "NotoSansKannada",
    fontSize: 9,
    textAlign: "center",
    color: BODY,
    marginTop: 2,
  },

  // Applicant block — identity summary + photo. The photo sits on the right:
  // printed sheets go into a spiral-bound register, and flipping through it
  // puts the right edge under the thumb, so the photo can be checked against
  // the member at a glance.
  applicant: {
    flexDirection: "row",
    marginTop: 14,
    // Name and numbers sit level with the middle of the photo, not its top.
    alignItems: "center",
  },
  photo: {
    width: 92,
    height: 118.3, // 92 * 9/7, the app's 7:9 passport ratio
    marginLeft: 16,
    objectFit: "cover",
  },
  photoPlaceholder: {
    width: 92,
    height: 118.3,
    marginLeft: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#c9c3b1",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: { fontSize: 8, color: MUTED },
  applicantText: { flex: 1 },
  applicantName: {
    fontFamily: "Times-Bold",
    fontSize: 16,
    marginBottom: 6,
    color: INK,
  },
  applicantMeta: { fontSize: 9, color: MUTED, marginBottom: 2 },

  // Sections — the two-column grid leaves the page well short of full, so the
  // sections spread out over whatever height is left (`space-between`), with
  // the office-use footer at the bottom. On a record long enough to need the
  // room (wrapped address/remarks) the gaps shrink back to `section`'s floor
  // instead of spilling onto a second page.
  sections: { flexGrow: 1, justifyContent: "space-between", marginTop: 6 },
  section: { marginTop: 10 },
  // English and Kannada are one <Text> with the Kannada nested inside, never
  // two sibling <Text>s in a flex row: siblings each top-align their own line
  // box, and Noto Sans Kannada's is much taller than Times', so the Kannada
  // rode visibly higher than the English beside it. Nested runs share a
  // single line and baseline.
  band: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.1,
    color: MUTED,
    borderBottomWidth: 0.75,
    borderBottomColor: RULE,
    paddingBottom: 4,
    marginBottom: 2,
  },
  bandKn: { fontFamily: "NotoSansKannada", letterSpacing: 0 },
  row: {
    flexDirection: "row",
    gap: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 5,
  },
  cell: { flex: 1, flexDirection: "row", fontSize: 9.5 },
  // Same width in a half-row cell and a wide row, so the left column's
  // values line up all the way down the page.
  label: { width: 138, paddingRight: 8, color: MUTED },
  labelKn: { fontFamily: "NotoSansKannada" },
  value: { flex: 1, color: INK },
  valueKn: { fontFamily: "NotoSansKannada" },

  // Footer — "for office use" band, filled in rather than blank (this is a
  // completed record, not an intake form waiting on a signature).
  footer: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 14,
    borderWidth: 0.75,
    borderColor: RULE,
    backgroundColor: "#f7f6f2",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  footerLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: MUTED,
  },
  footerItem: { fontSize: 9, color: MUTED },
  footerValue: { fontFamily: "Helvetica-Bold", color: INK },
});

/**
 * Kannada org name, the letterhead's headline. Drawn from outlines shaped
 * by HarfBuzz (scripts/build-org-name-kn.mts) rather than as <Text>:
 * react-pdf's shaper can't render its ರ + ZWJ + ್ + ಸ spelling (ಫರ‍್ಸ್) and
 * draws a dotted circle instead.
 *
 * 12.5pt keeps it on one line in the ~483pt beside the seal — at 14 it
 * wrapped, and at 13 it touched the margin.
 */
const ORG_NAME_KN_SIZE = 12.5;

function OrgNameKn() {
  const { upem, width, height, d } = ORG_NAME_KN_OUTLINE;
  const scale = ORG_NAME_KN_SIZE / upem;
  return (
    <Svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: width * scale, height: height * scale }}
    >
      <Path d={d} fill={INK} />
    </Svg>
  );
}

function Band({ en, kn }: { en: string; kn?: string }) {
  return (
    <Text style={styles.band}>
      {en.toUpperCase()}
      {kn ? <Text style={styles.bandKn}>{"  " + kn}</Text> : null}
    </Text>
  );
}

function Cell({ field }: { field: PdfField }) {
  const display =
    field.value === null || field.value === "" ? "—" : String(field.value);
  return (
    <View style={styles.cell}>
      <Text style={styles.label}>
        {field.label}
        {field.labelKn ? <Text style={styles.labelKn}>{" " + field.labelKn}</Text> : null}
      </Text>
      <Text style={styles.value}>
        {display}
        {field.valueKn ? <Text style={styles.valueKn}>{" " + field.valueKn}</Text> : null}
      </Text>
    </View>
  );
}

/** Pairs consecutive fields two to a row; a `wide` field takes a row alone. */
export function layoutRows(fields: PdfField[]): PdfField[][] {
  const rows: PdfField[][] = [];
  let pending: PdfField | null = null;
  for (const field of fields) {
    if (field.wide) {
      if (pending) rows.push([pending]);
      pending = null;
      rows.push([field]);
    } else if (pending) {
      rows.push([pending, field]);
      pending = null;
    } else {
      pending = field;
    }
  }
  if (pending) rows.push([pending]);
  return rows;
}

function Row({ fields }: { fields: PdfField[] }) {
  const [first, second] = fields;
  return (
    <View style={styles.row} wrap={false}>
      <Cell field={first} />
      {second ? (
        <Cell field={second} />
      ) : first.wide ? null : (
        // An unpaired half-width field keeps its half, not the whole row.
        <View style={styles.cell} />
      )}
    </View>
  );
}

export interface ApplicationPdfData {
  /** `null` when the member has no application on file — the template
   * renders an em-dash rather than the string "null". */
  applicationNo: string | null;
  legacyId: string | null;
  memberName: string;
  reviewedAt: Date | null;
  sections: PdfSection[];
  photo: PdfPhoto | null;
}

export function ApplicationPdfDocument({ data }: { data: ApplicationPdfData }) {
  const { applicationNo, legacyId, memberName, reviewedAt, sections, photo } = data;
  const applicationNoDisplay = applicationNo ?? "—";

  return (
    <Document
      title={`${applicationNoDisplay} — ${memberName}`}
      author="MDPVA"
      subject="Approved membership record"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.letterhead}>
          <View style={styles.logoBlock}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's <Image>, not an HTML <img>; it has no alt prop */}
            <Image style={styles.logo} src={{ data: logoBuffer, format: "png" }} />
            <Text style={styles.regNo}>Reg No. {ORG.regNo}</Text>
          </View>
          <View style={styles.letterheadText}>
            <OrgNameKn />
            <Text style={styles.orgNameEn}>{ORG.nameEn}</Text>
            <Text style={styles.orgPlace}>{ORG.place}</Text>
            <Text style={styles.orgAddress}>{ORG.address}</Text>
          </View>
        </View>

        <View style={styles.ruleThick} />
        <View style={styles.ruleThin} />

        <View style={styles.titleBlock}>
          <Text style={styles.titleEn}>{S.sheetTitle.en}</Text>
          <Text style={styles.titleKn}>{S.sheetTitle.kn}</Text>
        </View>

        <View style={styles.applicant}>
          <View style={styles.applicantText}>
            {/* Capitals, matching the "Full name" row (see buildApplicationPdfSections). */}
            <Text style={styles.applicantName}>{memberName.toUpperCase()}</Text>
            <Text style={styles.applicantMeta}>Application {applicationNoDisplay}</Text>
            <Text style={styles.applicantMeta}>Membership no. {legacyId ?? "—"}</Text>
          </View>
          {photo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's <Image>, not an HTML <img>; it has no alt prop
            <Image
              style={styles.photo}
              src={{ data: photo.buffer, format: photo.format }}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>No photo</Text>
            </View>
          )}
        </View>

        <View style={styles.sections}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section} wrap={false}>
              <Band en={section.title} kn={section.titleKn} />
              {layoutRows(section.fields).map((row) => (
                <Row key={row[0].label} fields={row} />
              ))}
            </View>
          ))}
        </View>

        <View style={styles.footer} wrap={false}>
          <Text style={styles.footerLabel}>{S.officeUse.en}</Text>
          <Text style={styles.footerItem}>
            Application no. <Text style={styles.footerValue}>{applicationNoDisplay}</Text>
          </Text>
          <Text style={styles.footerItem}>
            Approved{" "}
            <Text style={styles.footerValue}>
              {reviewedAt ? formatDateIST(reviewedAt) : "—"}
            </Text>
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderApplicationPdf(data: ApplicationPdfData): Promise<Buffer> {
  return renderToBuffer(<ApplicationPdfDocument data={data} />);
}

/**
 * Builds the downloadable PDF buffer for an `{application, member}` pair —
 * the part shared by the two download routes (`/api/applications/[id]/pdf`
 * and `/api/members/[id]/pdf`), which differ only in how they look that
 * pair up. `application` is `null` for a member with no application on file
 * at all (see `getMemberForPdf`); the returned `applicationNo` is then also
 * `null`, and the filename falls back to the member's own id.
 *
 * `reviewedAt` only ever shows for an *approved* application — a rejected or
 * still-pending one's `reviewedAt`/`null` would otherwise read as "approved
 * on this date" or "not yet reviewed" for a submission that was in fact
 * rejected.
 */
export async function renderApplicationPdfForRecord(
  application: Application | null,
  member: Member,
): Promise<{ buffer: Buffer; applicationNo: string | null }> {
  const photo = await fetchMemberPhotoForPdf(member.photoKey);
  const sections = buildApplicationPdfSections(member);
  const memberName = fullName(member.firstName);

  const buffer = await renderApplicationPdf({
    applicationNo: application?.applicationNo ?? null,
    legacyId: member.legacyId,
    memberName,
    reviewedAt: application?.status === "approved" ? application.reviewedAt : null,
    sections,
    photo,
  });

  return { buffer, applicationNo: application?.applicationNo ?? null };
}
