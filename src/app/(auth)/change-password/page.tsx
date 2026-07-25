import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";

import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-mdpva-paper px-6 py-16">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-mdpva-accent">
            MDPVA
          </span>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground">
            Set a new password
          </h1>
          <p className="text-sm text-muted-foreground">
            {session.user.mustChangePassword
              ? "Your account requires a password change before continuing."
              : "Update your account password."}
          </p>
        </div>

        <ChangePasswordForm />
      </div>
    </div>
  );
}
