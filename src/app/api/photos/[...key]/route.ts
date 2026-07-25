import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { r2, R2_BUCKET } from "@/lib/r2";

/**
 * Streams a member photo from the private R2 bucket. Only reachable by an
 * authenticated session (any role — viewing photos is a viewer-level
 * action) so the bucket itself never needs to be public.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { key } = await params;
  // Only ever serve objects this app itself writes.
  if (key[0] !== "app" || key[1] !== "members" || key.length !== 3) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const object = await r2.send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: key.join("/") }),
    );
    if (!object.Body) {
      return new NextResponse("Not found", { status: 404 });
    }
    const bytes = await object.Body.transformToByteArray();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": object.ContentType ?? "image/webp",
        // NOT immutable: a member's photo key is reused across replacements
        // (see photoKeyFor), so the same URL's content can change.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
