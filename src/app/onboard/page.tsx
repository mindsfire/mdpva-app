import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STRINGS as S } from "@/lib/onboarding/i18n";

/**
 * Step 1 — verify.
 *
 * ⚠️ Not yet wired: the real check reads `legacy_id` + normalized phone from
 * the members table and is rate-limited via `application_attempts`. Both land
 * with the schema migration. For now this posts nowhere and the Continue link
 * jumps straight to the form so the layout can be reviewed.
 */
export default function OnboardVerifyPage() {
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

      <div className="mt-8 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="v-no" className="flex items-baseline gap-1.5 text-sm">
            {S.membershipNo.en}{" "}
            <span className="font-kn text-xs text-muted-foreground">
              {S.membershipNo.kn}
            </span>
          </label>
          <Input id="v-no" inputMode="numeric" placeholder="417" />
          <span className="text-xs text-muted-foreground">
            {S.membershipHint.en}
            <span className="font-kn mt-0.5 block">{S.membershipHint.kn}</span>
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="v-phone" className="flex items-baseline gap-1.5 text-sm">
            {S.phone.en}{" "}
            <span className="font-kn text-xs text-muted-foreground">
              {S.phone.kn}
            </span>
          </label>
          <Input id="v-phone" type="tel" inputMode="tel" placeholder="98450 11234" />
        </div>

        <Button className="mt-1 h-10 w-full" render={<Link href="/onboard/form" />}>
          {S.continue.en} · <span className="font-kn">{S.continue.kn}</span>
        </Button>

        <p className="rounded-lg border border-dashed border-mdpva-border px-3 py-2.5 text-xs text-muted-foreground">
          Preview build — verification isn&apos;t wired up yet, so Continue goes
          straight to the form.
        </p>
      </div>
    </main>
  );
}
