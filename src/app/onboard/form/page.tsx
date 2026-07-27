import { OnboardForm } from "@/components/onboard/onboard-form";

/**
 * Step 2 — the form.
 *
 * ⚠️ `membershipNo` and `prefill` are placeholders until the verify step is
 * wired: they will come from the scoped verification cookie, which is what
 * binds this page to exactly one member row.
 */
export default function OnboardFormPage() {
  return (
    <OnboardForm
      membershipNo="0417"
      prefill={{ firstName: "Aarav", lastName: "Sharma", phone: "98450 11234" }}
    />
  );
}
