import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { getLatestApplicationForMember } from "@/lib/onboarding/member-application";
import { readOnboardSession } from "@/lib/onboarding/session";
import { r2, R2_BUCKET } from "@/lib/r2";

/**
 * Serves a member their *own* submitted photo, so the form can show what's
 * already on file instead of making them re-take it to fix an address.
 *
 * Lives under `/onboard` rather than `/api` so the public-path prefix in
 * `proxy.ts` already covers it. As `/api/onboard-photo` it was silently
 * redirected to `/login` and returned HTML instead of an image, so a returning
 * member's existing photo never loaded — the exact integration hazard the spec
 * warns about, self-inflicted.
 *
 * Takes no key parameter by design. The object is derived entirely from the
 * onboarding session cookie, which is scoped to one member row — so there is
 * no id for a caller to tamper with and no way to reach anyone else's pending
 * photo. The admin route (`/api/photos/[...key]`) accepts keys because it is
 * behind an admin session; this one must not.
 */
export async function GET() {
  const session = await readOnboardSession();
  if (!session) {
    return new NextResponse("Not found", { status: 404 });
  }

  const application = await getLatestApplicationForMember(session.memberId);
  if (!application?.photoKey) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const object = await r2.send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: application.photoKey }),
    );
    if (!object.Body) {
      return new NextResponse("Not found", { status: 404 });
    }
    const bytes = await object.Body.transformToByteArray();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": object.ContentType ?? "image/webp",
        // Private and short: the underlying object changes on resubmission,
        // and this is a shared-device context.
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
