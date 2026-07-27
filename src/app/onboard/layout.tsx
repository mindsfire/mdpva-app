import { MdpvaLogo } from "@/components/brand/mdpva-logo";
import { ORG } from "@/lib/onboarding/i18n";

/**
 * Public onboarding shell. No session, no sidebar, no theme switcher — the
 * screens are always light, matching /login, because members arrive here from a
 * shared link with no account and no stored preference.
 *
 * ⚠️ These routes must stay excluded from the auth matcher in `src/proxy.ts`,
 * or every request is redirected to /login.
 */
export default function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="force-light min-h-svh bg-mdpva-paper">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-mdpva-border bg-card px-6 py-3">
        <MdpvaLogo size={30} />
        <span className="font-serif text-lg tracking-wide text-foreground">MDPVA</span>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
          {ORG.place}
        </span>
      </header>
      {children}
    </div>
  );
}
