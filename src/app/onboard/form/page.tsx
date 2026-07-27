import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { members } from "@/db/schema";
import { OnboardForm } from "@/components/onboard/onboard-form";
import { getLatestApplicationForMember } from "@/lib/onboarding/member-application";
import { readOnboardSession } from "@/lib/onboarding/session";
import { isoToDisplayableProfession } from "@/lib/onboarding/profession";

/**
 * Step 2 — status if they've already applied, otherwise the form.
 *
 * The scoped cookie is the only way in, and it names exactly one member row.
 * Prefill from `members` stays limited to name and phone; anything richer is
 * read back from the member's *own* application, which they typed themselves.
 */
export default async function OnboardFormPage() {
  const session = await readOnboardSession();
  if (!session) {
    redirect("/onboard");
  }

  const [row] = await db
    .select({
      firstName: members.firstName,
      lastName: members.lastName,
      phone: members.phone,
    })
    .from(members)
    .where(eq(members.id, session.memberId))
    .limit(1);

  const application = await getLatestApplicationForMember(session.memberId);

  return (
    <OnboardForm
      membershipNo={session.ledgerId}
      verifiedName={session.displayName}
      prefill={{
        firstName: row?.firstName ?? "",
        lastName: row?.lastName ?? "",
        phone: row?.phone ?? "",
      }}
      existing={
        application && application.status !== "superseded"
          ? {
              applicationNo: application.applicationNo,
              status: application.status as "pending" | "approved" | "rejected",
              submittedAt: application.createdAt,
              reviewedAt: application.reviewedAt,
              rejectionReason: application.rejectionReason,
              photoKey: application.photoKey,
              values: {
                firstName: application.firstName ?? "",
                lastName: application.lastName ?? "",
                phone: application.phone ?? "",
                email: application.email ?? "",
                addressLine1: application.addressLine1 ?? "",
                addressLine2: application.addressLine2 ?? "",
                area: application.area ?? "",
                pincode: application.pincode ?? "",
                city: application.city ?? "",
                state: application.state ?? "",
                profession: isoToDisplayableProfession(application.profession),
                businessName: application.businessName ?? "",
                dob: application.dob ?? "",
                bloodGroup: application.bloodGroup ?? "",
              },
            }
          : null
      }
    />
  );
}
