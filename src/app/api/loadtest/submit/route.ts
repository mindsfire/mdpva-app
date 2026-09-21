import { NextRequest, NextResponse } from "next/server";

import { submitApplicationAction } from "@/app/actions/onboard-submit";

/**
 * Test-only wrapper around `submitApplicationAction`, so a load tool can hit
 * the real submit path (validation, aadhaar uniqueness, encryption, R2
 * upload, insert) directly with a cookie minted by `scripts/loadtest/seed.ts`
 * — without needing to script the Turnstile-gated verify step, and without
 * needing to replicate Next's internal Server Action wire protocol.
 *
 * Fails closed: 404s unless `LOADTEST_KEY` is set in the environment AND the
 * caller sends a matching `x-loadtest-key` header. Never set `LOADTEST_KEY`
 * on a production environment — this route performs the same writes the real
 * form does, with none of the human-facing captcha/rate-limit protection.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.LOADTEST_KEY;
  if (!expected || req.headers.get("x-loadtest-key") !== expected) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const formData = await req.formData();
  const result = await submitApplicationAction(formData);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
