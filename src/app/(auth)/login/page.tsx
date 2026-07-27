import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { MdpvaLogo } from "@/components/brand/mdpva-logo";

import hero1 from "@/assets/login/hero-1.jpg";
import hero2 from "@/assets/login/hero-2.jpg";
import hero3 from "@/assets/login/hero-3.jpg";
import { LoginForm } from "./login-form";
import { Slideshow } from "./slideshow";

const HERO_IMAGES = [hero1, hero2, hero3];

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    // Login is always light — no theme switcher here by design.
    <div className="force-light relative flex min-h-svh flex-col md:flex-row">
      {/* Right (desktop) / background (mobile): full-bleed slideshow */}
      <div className="absolute inset-0 md:relative md:order-2 md:h-svh md:flex-1">
        <Slideshow images={HERO_IMAGES} />
      </div>

      {/* Left (desktop): 480px paper panel / floating card (mobile) */}
      <div className="relative z-10 flex flex-1 items-end justify-center p-6 md:order-1 md:flex md:w-[480px] md:flex-none md:items-center md:justify-start md:bg-mdpva-paper md:p-12">
        <div className="w-full max-w-sm rounded-2xl bg-mdpva-white/95 p-6 shadow-xl backdrop-blur-sm md:max-w-none md:rounded-none md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none dark:bg-card/95 md:dark:bg-transparent">
          <div className="mb-8 flex flex-col gap-1.5">
            <MdpvaLogo size={56} className="mb-2" priority />
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-mdpva-accent">
              MDPVA
            </span>
            <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
              Members Portal
            </h1>
            <p className="text-sm text-muted-foreground">
              For MDPVA office staff.
            </p>
          </div>

          <LoginForm />

          {/*
            Members have no accounts, but they will land here: the onboarding
            link circulates on WhatsApp, and people return to the bare domain
            later. Without a signpost they try to sign in with a phone number,
            fail, and ring the office — so this redirects them to the flow they
            actually want, before they touch the form above.
          */}
          <div className="mt-7 border-t border-mdpva-border pt-5">
            <p className="text-sm text-muted-foreground">
              Are you an MDPVA member updating your own details?
            </p>
            <p className="font-kn mt-1 text-sm text-muted-foreground">
              ನಿಮ್ಮ ಸ್ವಂತ ವಿವರಗಳನ್ನು ನವೀಕರಿಸುತ್ತಿರುವ ಸದಸ್ಯರೇ?
            </p>
            {/*
              `inline`, not `inline-flex`: with flex the English text node and
              the Kannada span become two flex items, and flex aligns items by
              box rather than baseline — Archivo and Noto Sans Kannada sit at
              different heights inside an identical box, so the Kannada floats.
              Plain inline content shares one baseline. Same issue as the
              bilingual buttons; see components/onboard/bilingual.tsx.
            */}
            <Link
              href="/onboard"
              className="mt-2.5 inline text-sm font-medium text-mdpva-accent underline underline-offset-4 hover:text-mdpva-accent-hover"
            >
              Go to the member details form{" "}
              <span className="font-kn">· ಸದಸ್ಯರ ನಮೂನೆಗೆ ಹೋಗಿ</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
