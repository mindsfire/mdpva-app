import { z } from "zod";

/** Fits Postgres `integer`, and comfortably above any real donation. */
export const MAX_DONATION_AMOUNT = 2_000_000_000;

/** Digits only, so "1,00,000" typed or pasted reads as 100000. */
export function parseAmount(input: string): number | null {
  const digits = input.replace(/[,\s]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  return Number(digits);
}

/** Indian digit grouping: 100000 → "1,00,000". */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    amount,
  );
}

export function formatRupees(amount: number): string {
  return `₹${formatAmount(amount)}`;
}

/**
 * Used by both the form and the server actions. Name and business are free
 * text in any script, so Kannada and English are both accepted as typed.
 */
export const donationSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120, "Name is too long."),
  businessName: z.string().trim().max(160, "Business name is too long."),
  amount: z.string().refine(
    (value) => {
      const amount = parseAmount(value);
      return amount !== null && amount > 0 && amount <= MAX_DONATION_AMOUNT;
    },
    { error: "Enter the amount in whole rupees." },
  ),
});

export type DonationValues = z.infer<typeof donationSchema>;
