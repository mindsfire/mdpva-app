import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { members } from "@/db/schema";
import { OnboardForm } from "@/components/onboard/onboard-form";
import { readOnboardSession } from "@/lib/onboarding/session";

/**
 * Step 2 — the form.
 *
 * The scoped cookie is the only way in, and it names exactly one member row.
 * Prefill is limited to what a member already knows about themselves (name,
 * phone): the session must not become a way to read the rest of a record
 * someone merely guessed their way into.
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

  return (
    <OnboardForm
      membershipNo={session.ledgerId}
      verifiedName={session.displayName}
      prefill={{
        firstName: row?.firstName ?? "",
        lastName: row?.lastName ?? "",
        phone: row?.phone ?? "",
      }}
    />
  );
}
