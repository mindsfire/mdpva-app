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
        <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="32" fill="#161513" />
          <circle cx="32" cy="32" r="27" fill="none" stroke="#c9bc7e" strokeWidth="2.5" />
          <text
            x="32" y="34" textAnchor="middle" dominantBaseline="central"
            fontFamily="Georgia, serif" fontSize="30" fontWeight="600" fill="#e8c893"
          >M</text>
        </svg>
        <span className="font-serif text-lg tracking-wide text-foreground">MDPVA</span>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
          {ORG.place}
        </span>
      </header>
      {children}
    </div>
  );
}
