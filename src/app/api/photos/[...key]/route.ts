import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { SIGNED_URL_TTL_SECONDS, signingWindow } from "@/lib/photo-signing";
import { hasRole } from "@/lib/rbac";
import { r2, R2_BUCKET, thumbKeyFor } from "@/lib/r2";

/**
 * Hands an authenticated session (any role — viewing photos is a
 * viewer-level action) a short-lived signed link to a member photo in the
 * private R2 bucket, so the bucket itself never needs to be public.
 *
 * Redirects rather than streaming the bytes: everything a function returns
 * is billed as Vercel transfer, and member lists show up to 500 photos a
 * page. The browser fetches the image straight from R2, where egress is
 * free. The session check still runs on every uncached request; what a
 * caller gets is a link that expires (`SIGNED_URL_TTL_SECONDS`), not the
 * bucket.
 *
 * `?size=thumb` serves the small rendition when one exists — older photos
 * only get one from `scripts/backfill-thumbnails.ts` — and the full photo
 * otherwise. `?v=` versions the signed link; see `signingWindow`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { key } = await params;
  // Only ever serve objects this app itself writes.
  if (key[0] !== "app" || key.length !== 3) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (key[1] === "pending") {
    // Unapproved member submissions. Admin-only: these are photos nobody has
    // vetted yet, and they must never be reachable as if they were a member's
    // current directory photo.
    if (!hasRole(session.user.role, "admin")) {
      return new NextResponse("Not found", { status: 404 });
    }
  } else if (key[1] !== "members") {
    return new NextResponse("Not found", { status: 404 });
  }

  const { searchParams } = request.nextUrl;
  let objectKey = key.join("/");
  if (searchParams.get("size") === "thumb") {
    const thumbKey = thumbKeyFor(objectKey);
    try {
      await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: thumbKey }));
      objectKey = thumbKey;
    } catch {
      // No thumbnail yet; the full photo is a correct, just larger, answer.
    }
  }

  const { signingDate, redirectMaxAgeSeconds } = signingWindow(
    searchParams.get("v"),
  );
  // Signing is local HMAC work — no R2 round trip. A missing object surfaces
  // as R2's 404 on the image request, which <PhotoImg> already handles.
  const signedUrl = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: objectKey,
      ResponseContentType: "image/webp",
      // The signed URL is versioned (see signingWindow), so the bytes behind
      // it never change and the browser can keep them.
      ResponseCacheControl: `private, max-age=${SIGNED_URL_TTL_SECONDS}`,
    }),
    { expiresIn: SIGNED_URL_TTL_SECONDS, signingDate },
  );

  const response = NextResponse.redirect(signedUrl, 302);
  // 302s are only browser-cached with explicit freshness. Private: the
  // redirect carries a signed link and was issued to this session.
  response.headers.set("Cache-Control", `private, max-age=${redirectMaxAgeSeconds}`);
  return response;
}
