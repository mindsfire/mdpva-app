import { redirect } from "next/navigation";

import { auth } from "@/auth";

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
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-mdpva-accent">
              MDPVA
            </span>
            <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
              Members Portal
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to manage members and dues.
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
