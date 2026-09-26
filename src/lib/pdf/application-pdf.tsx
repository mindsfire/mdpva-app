import fs from "node:fs";
import path from "node:path";

import {
  Document,
  Font,
  Image,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { memberApplications, members } from "@/db/schema";
import { fullName } from "@/lib/member-name";
import { PROFESSION_LABELS } from "@/lib/member-sections";
import { ORG, STRINGS as S } from "@/lib/onboarding/i18n";
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
 * instance, which is all this document needs — no Kannada text here is bold.
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
   * `STRINGS` — office-only fields (status, fees, notes, …) have none, and
   * this module never invents Kannada copy of its own. */
  labelKn?: string;
  /** `null` means "recorded as empty" — the template renders an em-dash. */
  value: string | number | null;
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
      fields: [
        { label: "Full name", labelKn: S.fullName.kn, value: fullName(member.firstName) || null },
        { label: "Date of birth", labelKn: S.dob.kn, value: member.dob },
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
      fields: [
        { label: "Email", labelKn: S.email.kn, value: member.email },
        { label: "Phone", labelKn: S.phone.kn, value: member.phone },
      ],
    },
    {
      title: "Address",
      titleKn: S.sectionAddress.kn,
      fields: [
        { label: "Address line 1", labelKn: S.addressLine1.kn, value: member.addressLine1 },
        { label: "Address line 2", labelKn: S.addressLine2.kn, value: member.addressLine2 },
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
          value:
            member.profession === "other"
              ? (member.professionOther ?? PROFESSION_LABELS.other)
              : member.profession
                ? PROFESSION_LABELS[member.profession]
                : null,
        },
        { label: "Business", labelKn: S.businessName.kn, value: member.businessName },
      ],
    },
    {
      title: "Membership",
      fields: [
        { label: "Membership no.", labelKn: S.membershipNo.kn, value: member.legacyId },
        { label: "Member ID", value: member.memberId },
        { label: "Status", value: member.status },
        { label: "Fees paid upto", value: member.feesPaidUpto },
        {
          label: "Death fund",
          value: member.deathFundCovered ? "Covered" : "Not covered",
        },
        {
          // One row, not a section of its own: the layout is sized to fit one
          // A4 page (#37) and a separate three-row section pushed it onto two.
          label: "Nominee",
          labelKn: S.sectionNominee.kn,
          value: formatNominee(member),
        },
      ],
    },
    {
      title: "Notes",
      fields: [{ label: "Notes", value: member.notes }],
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

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

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
  logo: { width: 52, height: 52 },
  letterheadText: { flex: 1, alignItems: "center" },
  orgNameEn: {
    fontFamily: "Times-Bold",
    fontSize: 14,
    textAlign: "center",
    color: INK,
  },
  orgNameKn: {
    fontFamily: "NotoSansKannada",
    fontSize: 10,
    textAlign: "center",
    color: BODY,
    marginTop: 4,
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

  // Applicant block — photo + identity summary
  applicant: {
    flexDirection: "row",
    marginTop: 12,
    marginBottom: 4,
    alignItems: "flex-start",
  },
  photo: {
    width: 92,
    height: 118.3, // 92 * 9/7, the app's 7:9 passport ratio
    marginRight: 16,
    objectFit: "cover",
  },
  photoPlaceholder: {
    width: 92,
    height: 118.3,
    marginRight: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#c9c3b1",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: { fontSize: 8, color: MUTED },
  applicantText: { flex: 1, paddingTop: 4 },
  applicantName: {
    fontFamily: "Times-Bold",
    fontSize: 16,
    marginBottom: 4,
    color: INK,
  },
  applicantMeta: { fontSize: 9, color: MUTED, marginBottom: 1 },

  // Sections
  section: { marginTop: 4 },
  bandRow: {
    flexDirection: "row",
    alignItems: "baseline",
    borderBottomWidth: 0.75,
    borderBottomColor: RULE,
    paddingBottom: 3,
    marginBottom: 3,
  },
  bandEn: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: MUTED,
  },
  bandKn: {
    fontFamily: "NotoSansKannada",
    fontSize: 8,
    color: MUTED,
    marginLeft: 5,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 1.5,
  },
  labelCell: { width: 150, flexDirection: "row", flexWrap: "wrap" },
  labelEn: { color: MUTED },
  labelKn: { fontFamily: "NotoSansKannada", color: MUTED, marginLeft: 4 },
  value: { flex: 1, color: INK },

  // Footer — "for office use" band, filled in rather than blank (this is a
  // completed record, not an intake form waiting on a signature).
  footer: {
    marginTop: 10,
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

function Band({ en, kn }: { en: string; kn?: string }) {
  return (
    <View style={styles.bandRow} wrap={false}>
      <Text style={styles.bandEn}>{en.toUpperCase()}</Text>
      {kn ? <Text style={styles.bandKn}>{kn}</Text> : null}
    </View>
  );
}

function Row({ field }: { field: PdfField }) {
  const display =
    field.value === null || field.value === "" ? "—" : String(field.value);
  return (
    <View style={styles.row} wrap={false}>
      <View style={styles.labelCell}>
        <Text style={styles.labelEn}>{field.label}</Text>
        {field.labelKn ? <Text style={styles.labelKn}>{field.labelKn}</Text> : null}
      </View>
      <Text style={styles.value}>{display}</Text>
    </View>
  );
}

export interface ApplicationPdfData {
  /** `null` when the member has no application on file — the template
   * renders an em-dash rather than the string "null". */
  applicationNo: string | null;
  legacyId: string | null;
  memberId: string;
  memberName: string;
  reviewedAt: Date | null;
  sections: PdfSection[];
  photo: PdfPhoto | null;
}

export function ApplicationPdfDocument({ data }: { data: ApplicationPdfData }) {
  const { applicationNo, legacyId, memberId, memberName, reviewedAt, sections, photo } = data;
  const applicationNoDisplay = applicationNo ?? "—";

  return (
    <Document
      title={`${applicationNoDisplay} — ${memberName}`}
      author="MDPVA"
      subject="Approved membership record"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.letterhead}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's <Image>, not an HTML <img>; it has no alt prop */}
          <Image style={styles.logo} src={{ data: logoBuffer, format: "png" }} />
          <View style={styles.letterheadText}>
            <Text style={styles.orgNameEn}>{ORG.nameEn}</Text>
            <Text style={styles.orgNameKn}>{ORG.nameKn}</Text>
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
          <View style={styles.applicantText}>
            <Text style={styles.applicantName}>{memberName}</Text>
            <Text style={styles.applicantMeta}>Application {applicationNoDisplay}</Text>
            <Text style={styles.applicantMeta}>Membership no. {legacyId ?? "—"}</Text>
            <Text style={styles.applicantMeta}>Member ID {memberId}</Text>
          </View>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section} wrap={false}>
            <Band en={section.title} kn={section.titleKn} />
            {section.fields.map((field) => (
              <Row key={field.label} field={field} />
            ))}
          </View>
        ))}

        <View style={styles.footer} wrap={false}>
          <Text style={styles.footerLabel}>{S.officeUse.en}</Text>
          <Text style={styles.footerItem}>
            Application no. <Text style={styles.footerValue}>{applicationNoDisplay}</Text>
          </Text>
          <Text style={styles.footerItem}>
            Approved{" "}
            <Text style={styles.footerValue}>
              {reviewedAt ? dateFmt.format(reviewedAt) : "—"}
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
    memberId: member.memberId,
    memberName,
    reviewedAt: application?.status === "approved" ? application.reviewedAt : null,
    sections,
    photo,
  });

  return { buffer, applicationNo: application?.applicationNo ?? null };
}
