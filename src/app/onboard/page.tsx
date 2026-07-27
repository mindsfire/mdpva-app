import { redirect } from "next/navigation";

import { readOnboardSession } from "@/lib/onboarding/session";
import { STRINGS as S } from "@/lib/onboarding/i18n";

import { VerifyForm } from "./verify-form";

/** Step 1 — prove membership number + phone on record. */
export default async function OnboardVerifyPage() {
  // Already verified and still within the window — don't make them do it twice.
  if (await readOnboardSession()) {
    redirect("/onboard/form");
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <p className="text-xs font-medium tracking-[0.2em] text-mdpva-accent uppercase">
        MDPVA
      </p>
      <h1 className="mt-1.5 font-serif text-3xl font-medium tracking-tight text-foreground">
        {S.verifyTitle.en}
      </h1>
      <p className="font-kn mt-1 text-lg text-muted-foreground">
        {S.verifyTitle.kn}
      </p>

      <p className="mt-4 text-sm text-muted-foreground">
        {S.verifyIntro.en}
        <span className="font-kn mt-1.5 block">{S.verifyIntro.kn}</span>
      </p>

      <VerifyForm />
    </main>
  );
}
